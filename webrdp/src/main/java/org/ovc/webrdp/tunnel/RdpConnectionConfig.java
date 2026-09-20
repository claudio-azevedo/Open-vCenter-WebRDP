package org.ovc.webrdp.tunnel;

import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * Builds a GuacamoleConfiguration for RDP connections based on request parameters.
 * Supports standard RDP and HyperV console (vmconnect) over port 2179.
 */
public class RdpConnectionConfig {

    private static final String DEFAULT_RDP_PORT = "3389";
    private static final String HYPERV_PORT = "2179";

    /**
     * Creates a GuacamoleConfiguration from the provided parameters.
     *
     * @param hostname  RDP target hostname/IP
     * @param port      RDP port (3389 for standard, 2179 for HyperV)
     * @param username  RDP username
     * @param password  RDP password
     * @param domain    Windows domain (optional)
     * @param security  Security mode: nla, tls, rdp, any (optional, defaults to "nla")
     * @param vmGuid    Hyper-V VM GUID for vmconnect/pcb (optional, used with port 2179)
     * @param width     Screen width (optional)
     * @param height    Screen height (optional)
     * @return configured GuacamoleConfiguration
     */
    public static GuacamoleConfiguration build(String hostname, String port,
            String username, String password, String domain, String security,
            String vmGuid, String width, String height) {

        GuacamoleConfiguration config = new GuacamoleConfiguration();
        config.setProtocol("rdp");

        String effectivePort = port != null && !port.isEmpty() ? port : DEFAULT_RDP_PORT;
        boolean isVmConnect = HYPERV_PORT.equals(effectivePort);

        // Required parameters
        config.setParameter("hostname", hostname);
        config.setParameter("port", effectivePort);

        // Credentials
        if (username != null && !username.isEmpty()) {
            config.setParameter("username", username);
        }
        if (password != null && !password.isEmpty()) {
            config.setParameter("password", password);
        }
        if (domain != null && !domain.isEmpty()) {
            config.setParameter("domain", domain);
        }

        // Certificate validation
        config.setParameter("ignore-cert", "true");
        config.setParameter("cert-tofu", "true");

        // HyperV console / vmconnect support (preconnection-blob over port 2179)
        if (vmGuid != null && !vmGuid.isEmpty()) {
            config.setParameter("preconnection-blob", vmGuid);
        }

        if (isVmConnect) {
            // HyperV vmconnect - dedicated "vmconnect" security mode in guacd 1.6.0.
            // Preconnection blob is the VM GUID (set above); ignore-cert handles
            // the host's self-signed certificate.
            config.setParameter("security", "vmconnect");
        } else {
            // Standard RDP connection
            config.setParameter("security", security != null && !security.isEmpty() ? security : "nla");
            config.setParameter("color-depth", "24");
        }

        // Screen resolution
        if (width != null && !width.isEmpty()) {
            config.setParameter("width", width);
        }
        if (height != null && !height.isEmpty()) {
            config.setParameter("height", height);
        }

        // Disable audio
        config.setParameter("enable-audio-input", "false");
        config.setParameter("disable-audio", "true");

        // Disable printing and drive mapping
        config.setParameter("enable-printing", "false");
        config.setParameter("enable-drive", "false");

        // Disable wallpaper/theming for performance
        config.setParameter("enable-wallpaper", "false");
        config.setParameter("enable-theming", "false");
        config.setParameter("enable-font-smoothing", "true");

        return config;
    }
}
