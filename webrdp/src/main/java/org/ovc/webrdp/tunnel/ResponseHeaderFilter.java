package org.ovc.webrdp.tunnel;

import java.io.IOException;
import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletResponse;

/**
 * Sets response headers so the app can be embedded in an iframe by the
 * ovc-frontend console tab.
 *
 * <p>Embedding is controlled by a single Content-Security-Policy
 * {@code frame-ancestors} directive, sourced from the {@code WEBRDP_FRAME_ANCESTORS}
 * environment variable (default {@code *} - any origin). The legacy, non-standard
 * {@code X-Frame-Options: ALLOWALL} is intentionally NOT sent: it is not a valid
 * token and some browsers fall back to DENY, which broke embedding.
 */
public class ResponseHeaderFilter implements Filter {

    private String frameAncestors;

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        String value = System.getenv("WEBRDP_FRAME_ANCESTORS");
        if (value == null || value.trim().isEmpty()) {
            value = System.getProperty("webrdp.frameAncestors", "*");
        }
        this.frameAncestors = value.trim();
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletResponse httpResponse = (HttpServletResponse) response;

        // Who is allowed to frame this app (the ovc-frontend origin, or any).
        httpResponse.setHeader("Content-Security-Policy", "frame-ancestors " + frameAncestors);

        // The Guacamole tunnel is same-origin (relative URL) so CORS is not needed
        // for it; these stay permissive only for the odd cross-origin asset fetch.
        httpResponse.setHeader("Access-Control-Allow-Origin", "*");
        httpResponse.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        httpResponse.setHeader("Access-Control-Allow-Headers", "Content-Type");

        chain.doFilter(request, response);
    }

    @Override
    public void destroy() {
        // No cleanup needed
    }
}
