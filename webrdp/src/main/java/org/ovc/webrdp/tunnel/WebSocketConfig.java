package org.ovc.webrdp.tunnel;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import javax.websocket.Endpoint;
import javax.websocket.server.ServerApplicationConfig;
import javax.websocket.server.ServerEndpointConfig;

/**
 * Registers WebSocket endpoints with the servlet container.
 * This is needed because Tomcat may not auto-scan @ServerEndpoint annotations
 * in WAR files built with Maven overlays.
 */
public class WebSocketConfig implements ServerApplicationConfig {

    @Override
    public Set<ServerEndpointConfig> getEndpointConfigs(Set<Class<? extends Endpoint>> endpointClasses) {
        // No programmatic endpoints
        return Collections.emptySet();
    }

    @Override
    public Set<Class<?>> getAnnotatedEndpointClasses(Set<Class<?>> scanned) {
        // Explicitly register our annotated WebSocket endpoint
        Set<Class<?>> endpoints = new HashSet<>();
        endpoints.add(RdpWebSocketTunnelEndpoint.class);
        return endpoints;
    }
}
