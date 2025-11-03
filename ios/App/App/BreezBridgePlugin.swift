import Foundation
import Capacitor
import BreezSDK

@objc(BreezBridgePlugin)
public class BreezBridgePlugin: CAPPlugin {
    
    private var breezServices: BlockingBreezServices?
    
    @objc func connect(_ call: CAPPluginCall) {
        guard let certificate = call.getString("certificate") else {
            call.reject("Certificate is required")
            return
        }
        
        DispatchQueue.global(qos: .background).async {
            do {
                let greenlightConfig = GreenlightNodeConfig(
                    partnerCredentials: nil,
                    inviteCode: Data(certificate.utf8)
                )
                
                let nodeConfig = NodeConfig.greenlight(config: greenlightConfig)
                
                let config = Config(
                    breezserver: "https://bs1.breez.technology",
                    chainnotifierUrl: "https://chainnotifier.breez.technology",
                    mempoolspaceUrl: nil,
                    workingDir: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].path + "/.breez",
                    network: Network.bitcoin,
                    paymentTimeoutSec: 60,
                    defaultLspId: nil,
                    apiKey: nil,
                    maxfeePercent: 0.5,
                    exemptfee: Satoshi(value: 25),
                    nodeConfig: nodeConfig
                )
                
                let seed = try mnemonicToSeed(phrase: "your mnemonic here") // TODO: Get from secure storage
                
                let connectRequest = ConnectRequest(config: config, seed: seed)
                
                self.breezServices = try connect(req: connectRequest, eventListener: { event in
                    // Forward events to JS
                    self.notifyListeners("breezEvent", data: [:])
                })
                
                call.resolve()
            } catch {
                call.reject("Failed to connect: \(error.localizedDescription)")
            }
        }
    }
    
    @objc func getNodeInfo(_ call: CAPPluginCall) {
        guard let breez = breezServices else {
            call.reject("Not connected")
            return
        }
        
        do {
            let nodeInfo = try breez.nodeInfo()
            
            call.resolve([
                "id": nodeInfo.id,
                "maxPayable": nodeInfo.maxPayableMsat / 1000,
                "maxReceivable": nodeInfo.maxReceivableMsat / 1000,
                "channelsBalanceMsat": nodeInfo.channelsBalanceMsat / 1000
            ])
        } catch {
            call.reject("Failed to get node info: \(error.localizedDescription)")
        }
    }
    
    @objc func createInvoice(_ call: CAPPluginCall) {
        guard let breez = breezServices else {
            call.reject("Not connected")
            return
        }
        
        guard let amountSats = call.getInt("amountSats") else {
            call.reject("Amount is required")
            return
        }
        
        let description = call.getString("description") ?? ""
        
        do {
            let req = ReceivePaymentRequest(
                amountMsat: UInt64(amountSats * 1000),
                description: description,
                preimage: nil,
                openingFeeParams: nil,
                useDescriptionHash: nil,
                expiry: nil,
                cltv: nil
            )
            
            let response = try breez.receivePayment(req: req)
            
            call.resolve([
                "bolt11": response.lnInvoice.bolt11,
                "paymentHash": response.lnInvoice.paymentHash
            ])
        } catch {
            call.reject("Failed to create invoice: \(error.localizedDescription)")
        }
    }
    
    @objc func payInvoice(_ call: CAPPluginCall) {
        guard let breez = breezServices else {
            call.reject("Not connected")
            return
        }
        
        guard let bolt11 = call.getString("bolt11") else {
            call.reject("Invoice is required")
            return
        }
        
        do {
            let req = SendPaymentRequest(bolt11: bolt11, amountMsat: nil)
            let response = try breez.sendPayment(req: req)
            
            call.resolve([
                "paymentHash": response.payment.id,
                "amountSats": response.payment.amountMsat / 1000
            ])
        } catch {
            call.reject("Failed to pay invoice: \(error.localizedDescription)")
        }
    }
    
    @objc func disconnect(_ call: CAPPluginCall) {
        if breezServices != nil {
            do {
                try breezServices?.disconnect()
                breezServices = nil
                call.resolve()
            } catch {
                call.reject("Failed to disconnect: \(error.localizedDescription)")
            }
        } else {
            call.resolve()
        }
    }
}

