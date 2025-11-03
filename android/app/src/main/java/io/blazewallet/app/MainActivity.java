package io.blazewallet.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.blazewallet.breez.BreezBridgePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register custom plugins
        registerPlugin(BreezBridgePlugin.class);
    }
}
