package io.blazewallet.breez;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import breez_sdk.BreezServices;
import breez_sdk.ConnectRequest;
import breez_sdk.Config;
import breez_sdk.NodeConfig;
import breez_sdk.GreenlightNodeConfig;
import breez_sdk.EventListener;
import breez_sdk.ReceivePaymentRequest;
import breez_sdk.SendPaymentRequest;

@CapacitorPlugin(name = "BreezBridge")
public class BreezBridgePlugin extends Plugin {
    
    private BreezServices breezServices;
    
    @PluginMethod
    public void connect(PluginCall call) {
        try {
            String certificate = call.getString("certificate");
            
            if (certificate == null) {
                call.reject("Certificate is required");
                return;
            }
            
            // Setup Greenlight config
            GreenlightNodeConfig greenlightConfig = new GreenlightNodeConfig(
                null, // partner credentials (optional)
                certificate.getBytes()
            );
            
            NodeConfig nodeConfig = NodeConfig.greenlight(greenlightConfig);
            
            Config config = new Config(
                "bitcoin", // network
                System.getProperty("user.home") + "/.breez", // working dir
                nodeConfig,
                null // event listener (optional)
            );
            
            ConnectRequest req = new ConnectRequest(config, System.getProperty("user.home") + "/.breez/seed");
            
            breezServices = BreezServices.connect(req, new EventListener() {
                @Override
                public void onEvent(Event e) {
                    // Forward events to JS
                    notifyListeners("breezEvent", null);
                }
            });
            
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to connect to Breez: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void getNodeInfo(PluginCall call) {
        try {
            if (breezServices == null) {
                call.reject("Not connected");
                return;
            }
            
            NodeState nodeInfo = breezServices.nodeInfo();
            
            JSObject ret = new JSObject();
            ret.put("id", nodeInfo.id);
            ret.put("maxPayable", nodeInfo.maxPayableMsat / 1000);
            ret.put("maxReceivable", nodeInfo.maxReceivableMsat / 1000);
            ret.put("channelsBalanceMsat", nodeInfo.channelsBalanceMsat / 1000);
            
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get node info: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void createInvoice(PluginCall call) {
        try {
            if (breezServices == null) {
                call.reject("Not connected");
                return;
            }
            
            Long amountSats = call.getLong("amountSats");
            String description = call.getString("description");
            
            if (amountSats == null) {
                call.reject("Amount is required");
                return;
            }
            
            ReceivePaymentRequest req = new ReceivePaymentRequest(
                amountSats * 1000, // Convert to msats
                description != null ? description : ""
            );
            
            ReceivePaymentResponse response = breezServices.receivePayment(req);
            
            JSObject ret = new JSObject();
            ret.put("bolt11", response.lnInvoice.bolt11);
            ret.put("paymentHash", response.lnInvoice.paymentHash);
            
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to create invoice: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void payInvoice(PluginCall call) {
        try {
            if (breezServices == null) {
                call.reject("Not connected");
                return;
            }
            
            String bolt11 = call.getString("bolt11");
            
            if (bolt11 == null) {
                call.reject("Invoice is required");
                return;
            }
            
            SendPaymentRequest req = new SendPaymentRequest(bolt11, null);
            SendPaymentResponse response = breezServices.sendPayment(req);
            
            JSObject ret = new JSObject();
            ret.put("paymentHash", response.payment.id);
            ret.put("amountSats", response.payment.amountMsat / 1000);
            
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to pay invoice: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void disconnect(PluginCall call) {
        try {
            if (breezServices != null) {
                breezServices.disconnect();
                breezServices = null;
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to disconnect: " + e.getMessage());
        }
    }
}

