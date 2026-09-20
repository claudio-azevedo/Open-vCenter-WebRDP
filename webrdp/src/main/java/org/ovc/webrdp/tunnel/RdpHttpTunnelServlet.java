package org.ovc.webrdp.tunnel;

import javax.servlet.http.HttpServletRequest;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleSocket;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.InetGuacamoleSocket;
import org.apache.guacamole.net.SimpleGuacamoleTunnel;
import org.apache.guacamole.protocol.ConfiguredGuacamoleSocket;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.apache.guacamole.servlet.GuacamoleHTTPTunnelServlet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * HTTP-based tunnel servlet for RDP connections.
 * Accepts connection parameters from the request query string.
 */
public class RdpHttpTunnelServlet extends GuacamoleHTTPTunnelServlet {

    private static final Logger logger = LoggerFactory.getLogger(RdpHttpTunnelServlet.class);

    @Override
    protected GuacamoleTunnel doConnect(HttpServletRequest request) throws GuacamoleException {

        // Extract connection parameters from request
        String hostname = request.getParameter("hostname");
        String port = request.getParameter("port");
        String username = request.getParameter("username");
        String password = request.getParameter("password");
        String domain = request.getParameter("domain");
        String security = request.getParameter("security");
        String vmGuid = request.getParameter("vm-guid");
        String width = request.getParameter("width");
        String height = request.getParameter("height");

        logger.info("=== HTTP Tunnel doConnect called ===");
        logger.info("Request URL: {}", request.getRequestURL());
        logger.info("Query String: {}", request.getQueryString());
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
        GuacamoleConfiguration config = RdpConnectionConfig.build(
                hostname, port, username, password, domain, security,
                vmGuid, width, height);

        logger.info("GuacamoleConfiguration built. Protocol: {}", config.getProtocol());

        // Connect to guacd
        try {
            logger.info("Attempting connection to guacd at {}:{}...",
                    GuacdConfig.getHostname(), GuacdConfig.getPort());

            InetGuacamoleSocket guacdSocket = new InetGuacamoleSocket(
                    GuacdConfig.getHostname(), GuacdConfig.getPort());

            logger.info("TCP connection to guacd established successfully");

            GuacamoleSocket socket = new ConfiguredGuacamoleSocket(guacdSocket, config);

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
}
