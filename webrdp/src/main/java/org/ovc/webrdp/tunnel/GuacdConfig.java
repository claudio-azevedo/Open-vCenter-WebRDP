package org.ovc.webrdp.tunnel;

/**
 * Configuration for connecting to guacd.
 * Reads GUACD_HOSTNAME and GUACD_PORT from environment variables.
 */
public class GuacdConfig {

    private static final String DEFAULT_GUACD_HOSTNAME = "localhost";
    private static final int DEFAULT_GUACD_PORT = 4822;

    /**
     * Returns the guacd hostname from the GUACD_HOSTNAME environment variable,
     * falling back to "localhost" if not set.
     */
    public static String getHostname() {
        String hostname = System.getenv("GUACD_HOSTNAME");
        if (hostname == null || hostname.isEmpty()) {
            hostname = System.getProperty("guacd.hostname", DEFAULT_GUACD_HOSTNAME);
        }
        return hostname;
    }

    /**
     * Returns the guacd port from the GUACD_PORT environment variable,
     * falling back to 4822 if not set.
     */
    public static int getPort() {
        String portStr = System.getenv("GUACD_PORT");
        if (portStr == null || portStr.isEmpty()) {
            portStr = System.getProperty("guacd.port", String.valueOf(DEFAULT_GUACD_PORT));
        }
        try {
            return Integer.parseInt(portStr);
        } catch (NumberFormatException e) {
            return DEFAULT_GUACD_PORT;
        }
    }
}
