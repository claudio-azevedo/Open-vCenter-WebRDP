package org.ovc.webrdp.tunnel;

import java.util.List;
import java.util.Map;
import javax.websocket.EndpointConfig;
import javax.websocket.Session;
import javax.websocket.server.ServerEndpoint;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleSocket;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.InetGuacamoleSocket;
import org.apache.guacamole.net.SimpleGuacamoleTunnel;
import org.apache.guacamole.protocol.ConfiguredGuacamoleSocket;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.apache.guacamole.websocket.GuacamoleWebSocketTunnelEndpoint;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * WebSocket-based tunnel endpoint for RDP connections.
 * Connection parameters are passed via query string on the WebSocket URL.
 */
@ServerEndpoint(value = "/websocket-tunnel", subprotocols = {"guacamole"})
public class RdpWebSocketTunnelEndpoint extends GuacamoleWebSocketTunnelEndpoint {

    private static final Logger logger = LoggerFactory.getLogger(RdpWebSocketTunnelEndpoint.class);

    @Override
    protected GuacamoleTunnel createTunnel(Session session, EndpointConfig config)
            throws GuacamoleException {

        // Get query parameters from the WebSocket session
        Map<String, List<String>> params = session.getRequestParameterMap();

        String hostname = getParam(params, "hostname");
        String port = getParam(params, "port");
        String username = getParam(params, "username");
        String password = getParam(params, "password");
        String domain = getParam(params, "domain");
        String security = getParam(params, "security");
        String vmGuid = getParam(params, "vm-guid");
        String width = getParam(params, "width");
        String height = getParam(params, "height");

        logger.info("=== WebSocket Tunnel createTunnel called ===");
        logger.info("Target RDP host: {}:{}", hostname, port);
        logger.info("Username: {}, Domain: {}, Security: {}", username, domain, security);
        logger.info("VM GUID (preconnection-blob): {}", vmGuid);
        logger.info("Resolution: {}x{}", width, height);
        logger.info("guacd target: {}:{}", GuacdConfig.getHostname(), GuacdConfig.getPort());

        // Validate required parameter
        if (hostname == null || hostname.isEmpty()) {
            logger.error("Hostname is required but was empty/null");
            throw new GuacamoleException("Hostname is required");
        }

        // Build RDP configuration
        GuacamoleConfiguration rdpConfig = RdpConnectionConfig.build(
                hostname, port, username, password, domain, security,
                vmGuid, width, height);

        logger.info("GuacamoleConfiguration built. Protocol: {}", rdpConfig.getProtocol());

        // Connect to guacd
        try {
            logger.info("Attempting connection to guacd at {}:{}...",
                    GuacdConfig.getHostname(), GuacdConfig.getPort());

            InetGuacamoleSocket guacdSocket = new InetGuacamoleSocket(
                    GuacdConfig.getHostname(), GuacdConfig.getPort());

            logger.info("TCP connection to guacd established successfully");

            GuacamoleSocket socket = new ConfiguredGuacamoleSocket(guacdSocket, rdpConfig);

            logger.info("Guacamole protocol handshake with guacd completed");

            GuacamoleTunnel tunnel = new SimpleGuacamoleTunnel(socket);
            logger.info("Tunnel created successfully, UUID: {}", tunnel.getUUID());

            return tunnel;

        } catch (GuacamoleException e) {
            logger.error("Failed to connect to guacd: {}", e.getMessage(), e);
            throw e;
        } catch (Exception e) {
            logger.error("Unexpected error connecting to guacd: {}", e.getMessage(), e);
            throw new GuacamoleException("Connection failed: " + e.getMessage(), e);
        }
    }

    /**
     * Helper to extract a single parameter value from the WebSocket parameter map.
     */
    private String getParam(Map<String, List<String>> params, String name) {
        List<String> values = params.get(name);
        if (values != null && !values.isEmpty()) {
            return values.get(0);
        }
        return null;
    }
}
