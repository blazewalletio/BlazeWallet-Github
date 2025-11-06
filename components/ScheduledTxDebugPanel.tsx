// ============================================================================
// 🔥 BLAZE WALLET - SCHEDULED TRANSACTIONS DEBUG PANEL
// ============================================================================
// Floating debug icon to view scheduled transaction logs
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, X, Download, Trash2, RefreshCw } from 'lucide-react';
import { scheduledTxDebugLogger } from '@/lib/scheduled-tx-debug-logger';

export default function ScheduledTxDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadLogs = () => {
    const allLogs = scheduledTxDebugLogger.getLogs();
    setLogs(allLogs);
  };

  useEffect(() => {
    loadLogs();
    
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 2000); // Refresh every 2 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, isOpen]);

  const handleExport = () => {
    const json = scheduledTxDebugLogger.exportLogs();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scheduled-tx-debug-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (confirm('Weet je zeker dat je alle logs wilt wissen?')) {
      scheduledTxDebugLogger.clearLogs();
      loadLogs();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLogColor = (step: string) => {
    if (step.includes('ERROR')) return 'text-red-600 bg-red-50';
    if (step.includes('SUCCESS')) return 'text-green-600 bg-green-50';
    if (step.includes('START')) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getLogIcon = (step: string) => {
    if (step.includes('ERROR')) return '❌';
    if (step.includes('SUCCESS')) return '✅';
    if (step.includes('START')) return '🚀';
    return '📋';
  };

  return (
    <>
      {/* Floating Debug Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg flex items-center justify-center cursor-pointer"
        title="Scheduled Transactions Debug Logs"
      >
        <Bug className="w-5 h-5" />
        {logs.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {logs.length > 99 ? '99+' : logs.length}
          </span>
        )}
      </motion.button>

      {/* Debug Panel Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-[100]"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90vw] md:max-w-4xl md:h-[80vh] z-[101] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <div className="flex items-center gap-3">
                  <Bug className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">
                    Scheduled Transactions Debug Logs
                  </h2>
                  <span className="text-sm bg-white/20 px-2 py-1 rounded">
                    {logs.length} entries
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`p-2 rounded-lg transition-colors ${
                      autoRefresh
                        ? 'bg-white/20 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                    title={autoRefresh ? 'Stop auto-refresh' : 'Start auto-refresh'}
                  >
                    <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={loadLogs}
                    className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                    title="Refresh logs"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleExport}
                    className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                    title="Export logs"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleClear}
                    className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                    title="Clear logs"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Logs List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {logs.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Bug className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Geen logs gevonden</p>
                    <p className="text-sm mt-2">
                      Logs worden automatisch opgeslagen wanneer je transacties plant of ophaalt.
                    </p>
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.01 }}
                      className={`p-3 rounded-lg border ${getLogColor(log.step)} border-gray-200`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-lg">{getLogIcon(log.step)}</span>
                          <span className="font-semibold text-sm truncate">
                            {log.step}
                          </span>
                          <span className="text-xs opacity-70 truncate">
                            {log.action}
                          </span>
                        </div>
                        <span className="text-xs opacity-70 whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      
                      {log.data && Object.keys(log.data).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer hover:underline">
                            Details bekijken
                          </summary>
                          <pre className="mt-2 text-xs bg-white/50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      )}
                      
                      {log.error && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                          <div className="font-semibold text-red-800">Error:</div>
                          <div className="text-red-700 mt-1">
                            {log.error.message || JSON.stringify(log.error)}
                          </div>
                          {log.error.stack && (
                            <details className="mt-2">
                              <summary className="cursor-pointer hover:underline">
                                Stack trace
                              </summary>
                              <pre className="mt-1 text-xs overflow-x-auto">
                                {log.error.stack}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
                <p>
                  Logs worden opgeslagen in localStorage. Ze worden automatisch gewist na {scheduledTxDebugLogger.getLogs().length > 500 ? '500' : '500'} entries.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}


