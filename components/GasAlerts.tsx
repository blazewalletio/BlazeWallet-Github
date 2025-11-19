'use client';

/**
 * 🔥 BLAZE WALLET - GAS PRICE ALERTS
 * 
 * Set alerts for optimal gas prices
 * - Alert when gas drops below threshold
 * - Chain-specific alerts
 * - Instant or daily summary
 * - Transaction context (optional)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, BellOff, Plus, X, Zap, Clock, TrendingDown,
  Check, AlertCircle, Settings
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { gasPriceService } from '@/lib/gas-price-service';
import { logger } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface GasAlert {
  id: string;
  chain: string;
  targetGasPrice: number;
  alertType: 'instant' | 'daily_summary';
  status: 'active' | 'paused' | 'triggered';
  lastTriggeredAt?: string;
  transactionContext?: any;
}

interface GasAlertsProps {
  userId: string;
  defaultChain?: string;
}

export default function GasAlerts({ userId, defaultChain = 'ethereum' }: GasAlertsProps) {
  const [alerts, setAlerts] = useState<GasAlert[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, [userId]);

  const loadAlerts = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('gas_alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAlerts(data?.map(a => ({
        id: a.id,
        chain: a.chain,
        targetGasPrice: a.target_gas_price,
        alertType: a.alert_type,
        status: a.status,
        lastTriggeredAt: a.last_triggered_at,
        transactionContext: a.transaction_context,
      })) || []);

    } catch (error: any) {
      logger.error('[Gas Alerts] Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('gas_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(alerts.filter(a => a.id !== alertId));

    } catch (error: any) {
      logger.error('[Gas Alerts] Failed to delete:', error);
    }
  };

  const toggleAlert = async (alertId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';

      const { error } = await supabase
        .from('gas_alerts')
        .update({ status: newStatus })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(alerts.map(a => 
        a.id === alertId ? { ...a, status: newStatus as any } : a
      ));

    } catch (error: any) {
      logger.error('[Gas Alerts] Failed to toggle:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-600" />
          <h3 className="font-bold text-gray-900">Gas Price Alerts</h3>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Alert
        </button>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium mb-2">No gas alerts set</p>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Get notified when gas prices drop below your target
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`p-4 rounded-2xl border-2 transition-all ${
                alert.status === 'active'
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    alert.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    {alert.status === 'active' ? (
                      <Bell className="w-5 h-5 text-white" />
                    ) : (
                      <BellOff className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 capitalize">{alert.chain}</p>
                    <p className="text-sm text-gray-600">
                      Target: &lt; {alert.targetGasPrice} gwei
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAlert(alert.id, alert.status)}
                    className="p-2 rounded-lg hover:bg-white transition-colors"
                  >
                    {alert.status === 'active' ? (
                      <Bell className="w-5 h-5 text-green-600" />
                    ) : (
                      <BellOff className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-2 rounded-lg hover:bg-white transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {alert.lastTriggeredAt && (
                <div className="text-xs text-gray-500">
                  Last triggered: {new Date(alert.lastTriggeredAt).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Alert Modal */}
      {showAddModal && (
        <AddAlertModal
          userId={userId}
          defaultChain={defaultChain}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadAlerts();
          }}
        />
      )}
    </div>
  );
}

interface AddAlertModalProps {
  userId: string;
  defaultChain: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddAlertModal({ userId, defaultChain, onClose, onSuccess }: AddAlertModalProps) {
  const [chain, setChain] = useState(defaultChain);
  const [targetGasPrice, setTargetGasPrice] = useState('');
  const [alertType, setAlertType] = useState<'instant' | 'daily_summary'>('instant');
  const [loading, setLoading] = useState(false);
  const [currentGas, setCurrentGas] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentGas();
  }, [chain]);

  const loadCurrentGas = async () => {
    try {
      const gas = await gasPriceService.getGasPrice(chain);
      setCurrentGas(gas.standard);
      
      // Suggest target: 70% of current gas
      if (!targetGasPrice) {
        setTargetGasPrice((gas.standard * 0.7).toFixed(0));
      }
    } catch (error) {
      logger.error('Failed to load current gas:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('gas_alerts')
        .insert({
          user_id: userId,
          chain,
          target_gas_price: parseFloat(targetGasPrice),
          alert_type: alertType,
          status: 'active',
        });

      if (insertError) throw insertError;

      onSuccess();

    } catch (err: any) {
      logger.error('Failed to create alert:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">New Gas Alert</h2>
          </div>
          <button
            onClick={onClose} aria-label="Close modal"
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Chain Selection */}
          <div>
            <label htmlFor="chain" className="block text-sm font-semibold text-gray-900 mb-2">
              Chain
            </label>
            <select
              id="chain"
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ethereum">Ethereum</option>
              <option value="polygon">Polygon</option>
              <option value="arbitrum">Arbitrum</option>
              <option value="optimism">Optimism</option>
              <option value="base">Base</option>
              <option value="bsc">BSC</option>
            </select>
          </div>

          {/* Current Gas */}
          {currentGas !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Current gas price</p>
                  <p className="text-2xl font-bold text-blue-900">{currentGas.toFixed(0)} gwei</p>
                </div>
                <Zap className="w-8 h-8 text-blue-500" />
              </div>
            </div>
          )}

          {/* Target Gas Price */}
          <div>
            <label htmlFor="targetGasPrice" className="block text-sm font-semibold text-gray-900 mb-2">
              Target Gas Price (gwei)
            </label>
            <input
              type="number"
              id="targetGasPrice"
              value={targetGasPrice}
              onChange={(e) => setTargetGasPrice(e.target.value)}
              required
              min="1"
              step="1"
              placeholder="e.g., 20"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">Alert triggers when gas drops below this</p>
          </div>

          {/* Alert Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Alert Type
            </label>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setAlertType('instant')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  alertType === 'instant'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-left">
                    <Zap className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="font-semibold text-gray-900">Instant</p>
                      <p className="text-sm text-gray-600">Notify immediately</p>
                    </div>
                  </div>
                  {alertType === 'instant' && <Check className="w-5 h-5 text-orange-500" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAlertType('daily_summary')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  alertType === 'daily_summary'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-left">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="font-semibold text-gray-900">Daily Summary</p>
                      <p className="text-sm text-gray-600">One notification per day</p>
                    </div>
                  </div>
                  {alertType === 'daily_summary' && <Check className="w-5 h-5 text-orange-500" />}
                </div>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading || !targetGasPrice}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold py-4 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Alert...
                </>
              ) : (
                <>
                  <Bell className="w-5 h-5" />
                  Create Alert
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

