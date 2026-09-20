/**
 * WebRDP - Slim Guacamole RDP/HyperV Web Client
 *
 * URL Parameters for pre-filling and auto-connect:
 *
 * Standard RDP:
 *   ?hostname=10.0.6.52&port=3389&username=admin&domain=MYDOMAIN&security=nla
 *
 * HyperV vmconnect:
 *   ?hostname=10.0.6.50&port=2179&username=admin&vm-guid=<vm-guid>&security=tls
 *
 * Auto-connect (skips the form - user must still enter password first):
 *   ?hostname=10.0.6.52&port=3389&username=admin&autoconnect=true
 *
 * Supported URL parameters:
 *   hostname    - RDP target host/IP (required for autoconnect)
 *   port        - RDP port (default: 3389, use 2179 for HyperV)
 *   username    - RDP username
 *   domain      - Windows domain
 *   security    - nla, tls, rdp, any
 *   vm-guid     - Hyper-V VM GUID for vmconnect (preconnection-blob)
 *   autoconnect - if "true", connects immediately (password must be filled)
 *
 * NOTE: Password is NOT accepted via URL for security reasons.
 *       It must always be entered manually in the form.
 */

var guac = null;
var keyboard = null;
var mouse = null;
var touch = null;

/**
 * Parse URL query parameters into an object.
 */
function getUrlParams() {
    var params = {};
    var search = window.location.search.substring(1); // remove leading '?'
    if (!search) return params;

    var pairs = search.split('&');
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        var key = decodeURIComponent(pair[0]);
        var value = pair.length > 1 ? decodeURIComponent(pair[1]) : '';
        params[key] = value;
    }
    return params;
}

/**
 * Pre-fill the form from URL parameters and optionally auto-connect.
 * When connection params come via URL, hide everything except username/password.
 */
function initFromUrl() {
    var params = getUrlParams();

    // Pre-fill form fields (password is intentionally NOT accepted via URL for security)
    if (params.hostname) document.getElementById('hostname').value = params.hostname;
    if (params.port) document.getElementById('port').value = params.port;
    if (params.username) document.getElementById('username').value = params.username;
    if (params.domain) document.getElementById('domain').value = params.domain;
    if (params.security) document.getElementById('security').value = params.security;
    if (params['vm-guid']) document.getElementById('vm-guid').value = params['vm-guid'];

    // Auto-detect connection type based on port or vm-guid
    if (params['vm-guid'] || params.port === '2179') {
        document.getElementById('conn-type').value = 'hyperv';
        document.getElementById('vm-guid-group').style.display = 'block';
        if (!params.port) document.getElementById('port').value = '2179';
    }

    // If hostname came via URL, hide connection fields and show only credentials
    if (params.hostname) {
        document.getElementById('group-conn-type').style.display = 'none';
        document.getElementById('group-hostname').style.display = 'none';
        document.getElementById('group-port').style.display = 'none';
        document.getElementById('vm-guid-group').style.display = 'none';
        document.getElementById('group-domain').style.display = 'none';
        document.getElementById('group-security').style.display = 'none';

        // Show username (pre-filled if provided) and password
        document.getElementById('group-username').style.display = 'block';
        document.getElementById('group-password').style.display = 'block';
    }

    // Auto-connect if requested (only if password is already filled)
    if (params.autoconnect === 'true' && params.hostname) {
        var pwd = document.getElementById('password').value;
        if (pwd) {
            setTimeout(function() {
                connectRDP();
            }, 100);
        }
    }
}

/**
 * Toggle connection type between standard RDP and HyperV console.
 */
function toggleConnectionType() {
    var connType = document.getElementById('conn-type').value;
    var vmGuidGroup = document.getElementById('vm-guid-group');
    var portField = document.getElementById('port');
    var securityField = document.getElementById('security');

    if (connType === 'hyperv') {
        vmGuidGroup.style.display = 'block';
        portField.value = '2179';
        securityField.value = 'tls'; // HyperV requires TLS, not NLA
    } else {
        vmGuidGroup.style.display = 'none';
        portField.value = '3389';
        securityField.value = 'nla';
        // Clear vm-guid so it's not sent for standard RDP
        document.getElementById('vm-guid').value = '';
    }
}

/**
 * Build query string from form values for the tunnel connection.
 */
function buildQueryString() {
    var params = [];

    var hostname = document.getElementById('hostname').value.trim();
    var port = document.getElementById('port').value.trim();
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value;
    var domain = document.getElementById('domain').value.trim();
    var security = document.getElementById('security').value;
    var vmGuid = document.getElementById('vm-guid').value.trim();

    // Get current display size for optimal resolution
    var width = window.innerWidth;
    var height = window.innerHeight - 50; // subtract toolbar height

    params.push('hostname=' + encodeURIComponent(hostname));
    params.push('port=' + encodeURIComponent(port));

    if (username) params.push('username=' + encodeURIComponent(username));
    if (password) params.push('password=' + encodeURIComponent(password));
    if (domain) params.push('domain=' + encodeURIComponent(domain));
    if (security) params.push('security=' + encodeURIComponent(security));
    if (vmGuid) params.push('vm-guid=' + encodeURIComponent(vmGuid));

    params.push('width=' + encodeURIComponent(width));
    params.push('height=' + encodeURIComponent(height));

    return params.join('&');
}

/**
 * Get the base path of the application (respects WEBAPP_CONTEXT).
 */
function getBasePath() {
    var path = window.location.pathname;
    // Remove trailing index.html if present
    if (path.endsWith('index.html')) {
        path = path.substring(0, path.lastIndexOf('/') + 1);
    }
    // Ensure path ends with /
    if (path.charAt(path.length - 1) !== '/') {
        path += '/';
    }
    // Ensure path starts with exactly one /
    while (path.indexOf('//') === 0) {
        path = path.substring(1);
    }
    return path;
}

/**
 * Connect to RDP host via Guacamole tunnel.
 */
function connectRDP() {
    var hostname = document.getElementById('hostname').value.trim();
    if (!hostname) {
        alert('Please enter a hostname or IP address.');
        return false;
    }

    // Build connection query string
    var queryString = buildQueryString();
    var basePath = getBasePath();

    console.log('[WebRDP] Base path: ' + basePath);
    console.log('[WebRDP] Query string: ' + queryString.replace(/password=[^&]*/, 'password=***'));

    // Use HTTP tunnel with relative URL (works regardless of context path)
    console.log('[WebRDP] Using HTTP tunnel: tunnel (relative)');
    var tunnel = new Guacamole.HTTPTunnel('tunnel');

    startClient(tunnel, queryString);
    return false; // Prevent form submission
}

/**
 * Initialize and start the Guacamole client.
 */
function startClient(tunnel, queryString) {
    // Show remote desktop UI
    document.getElementById('connection-form').style.display = 'none';
    document.getElementById('rdp-container').style.display = 'flex';

    var displayEl = document.getElementById('display');
    setStatus('Connecting...');

    // Tunnel state logging
    tunnel.onstatechange = function(state) {
        var states = ['CLOSED', 'CONNECTING', 'OPEN', 'CLOSED'];
        console.log('[WebRDP] Tunnel state: ' + (states[state] || state));
    };

    tunnel.onerror = function(status) {
        console.error('[WebRDP] Tunnel error:', status);
        var msg = 'Unknown tunnel error';
        if (status) {
            if (status.message) msg = status.message;
            else if (status.code) msg = 'Error code: ' + status.code;
        }
        console.error('[WebRDP] Tunnel error message: ' + msg);
        setStatus('Tunnel Error: ' + msg + ' (click Reconnect)');
    };

    // Create Guacamole client
    guac = new Guacamole.Client(tunnel);

    // Add display to DOM
    displayEl.appendChild(guac.getDisplay().getElement());

    // State change handler
    guac.onstatechange = function(state) {
        var stateNames = {
            0: 'Idle',
            1: 'Connecting',
            2: 'Waiting',
            3: 'Connected',
            4: 'Disconnecting',
            5: 'Disconnected'
        };
        var stateName = stateNames[state] || 'Unknown(' + state + ')';
        console.log('[WebRDP] Client state: ' + stateName);
        setStatus(stateName);

        if (state === 5) {
            setTimeout(showForm, 3000);
        }
    };

    // Error handler
    guac.onerror = function(error) {
        var msg = error.message || error.toString();
        console.error('[WebRDP] Client error:', error);
        setStatus('Error: ' + msg);
        alert('Connection error: ' + msg);
        showForm();
    };

    // Clipboard from remote
    guac.onclipboard = function(stream, mimetype) {
        if (mimetype === 'text/plain') {
            var reader = new Guacamole.StringReader(stream);
            var data = '';
            reader.ontext = function(text) {
                data += text;
            };
            reader.onend = function() {
                document.getElementById('clipboard-text').value = data;
            };
        }
    };

    // Connect with the query string parameters
    console.log('[WebRDP] Calling guac.connect() with params');
    guac.connect(queryString);

    // Setup input handlers
    setupInput(displayEl);
}

/**
 * Setup mouse, keyboard and touch input.
 */
function setupInput(displayEl) {
    // Mouse
    mouse = new Guacamole.Mouse(guac.getDisplay().getElement());
    mouse.onEach(['mousedown', 'mouseup', 'mousemove'], function(e) {
        guac.sendMouseState(e.state);
    });

    // Touch (for mobile/tablet)
    touch = new Guacamole.Mouse.Touchscreen(guac.getDisplay().getElement());
    touch.onEach(['mousedown', 'mouseup', 'mousemove'], function(e) {
        guac.sendMouseState(e.state);
    });

    // Keyboard - only capture when the display area has focus
    // This prevents interference with form inputs
    keyboard = new Guacamole.Keyboard(guac.getDisplay().getElement());

    // Make the display element focusable
    guac.getDisplay().getElement().setAttribute('tabindex', '0');

    // Focus display when clicked
    guac.getDisplay().getElement().addEventListener('mousedown', function() {
        guac.getDisplay().getElement().focus();
    });

    keyboard.onkeydown = function(keysym) {
        guac.sendKeyEvent(1, keysym);
    };
    keyboard.onkeyup = function(keysym) {
        guac.sendKeyEvent(0, keysym);
    };

    // Auto-fit display on resize
    function fitDisplay() {
        if (!guac) return;
        var display = guac.getDisplay();
        var displayWidth = display.getWidth();
        var displayHeight = display.getHeight();
        if (displayWidth <= 0 || displayHeight <= 0) return;

        var containerWidth = displayEl.offsetWidth;
        var containerHeight = displayEl.offsetHeight;
        if (containerWidth <= 0 || containerHeight <= 0) return;

        var scale = Math.min(
            containerWidth / displayWidth,
            containerHeight / displayHeight
        );
        display.scale(scale);
    }

    window.addEventListener('resize', fitDisplay);

    // Fit when display size changes (remote sends resize)
    guac.getDisplay().onresize = function(width, height) {
        console.log('[WebRDP] Remote display resized to: ' + width + 'x' + height);
        setTimeout(fitDisplay, 100);
    };

    // Auto-focus display
    setTimeout(function() {
        guac.getDisplay().getElement().focus();
    }, 500);
}

/**
 * Disconnect from current RDP session.
 */
function disconnectRDP() {
    if (guac) {
        guac.disconnect();
        guac = null;
    }
    if (keyboard) {
        keyboard.reset();
        keyboard = null;
    }
    mouse = null;
    touch = null;
    showForm();
}

/**
 * Reconnect to the same RDP session (re-uses form values).
 */
function reconnectRDP() {
    // Disconnect current session cleanly
    if (guac) {
        try { guac.disconnect(); } catch(e) {}
        guac = null;
    }
    if (keyboard) {
        try { keyboard.reset(); } catch(e) {}
        keyboard = null;
    }
    mouse = null;
    touch = null;

    // Clear display
    var displayEl = document.getElementById('display');
    while (displayEl.firstChild) {
        displayEl.removeChild(displayEl.firstChild);
    }

    // Reconnect using current form values
    setStatus('Reconnecting...');
    var queryString = buildQueryString();
    console.log('[WebRDP] Reconnecting...');
    var tunnel = new Guacamole.HTTPTunnel('tunnel');
    startClient(tunnel, queryString);
}

/**
 * Show the connection form and hide the RDP display.
 */
function showForm() {
    document.getElementById('rdp-container').style.display = 'none';
    document.getElementById('connection-form').style.display = 'block';

    // Clear display
    var displayEl = document.getElementById('display');
    while (displayEl.firstChild) {
        displayEl.removeChild(displayEl.firstChild);
    }
}

/**
 * Toggle clipboard panel visibility.
 */
function toggleClipboard() {
    var panel = document.getElementById('clipboard-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

/**
 * Send Ctrl+Alt+Del key combination.
 */
function sendCtrlAltDel() {
    if (guac) {
        guac.sendKeyEvent(1, 0xFFE3); // Ctrl
        guac.sendKeyEvent(1, 0xFFE9); // Alt
        guac.sendKeyEvent(1, 0xFFFF); // Delete
        guac.sendKeyEvent(0, 0xFFFF);
        guac.sendKeyEvent(0, 0xFFE9);
        guac.sendKeyEvent(0, 0xFFE3);
    }
}

/**
 * Type clipboard text character by character to the remote session.
 * Sends each character as a keydown/keyup event, simulating typing.
 */
function typeClipboardText() {
    if (!guac) return;

    var text = document.getElementById('clipboard-text').value;
    if (!text) {
        alert('Paste some text in the clipboard field first.');
        return;
    }

    var i = 0;
    var delay = 30; // ms between each character

    function typeNext() {
        if (i >= text.length) return;

        var char = text.charAt(i);
        var code = char.charCodeAt(0);
        var keysym;

        // Special keys
        if (char === '\n' || char === '\r') {
            keysym = 0xFF0D; // Return
        } else if (char === '\t') {
            keysym = 0xFF09; // Tab
        } else if (code <= 0xFF) {
            // Latin-1: keysym matches unicode codepoint directly
            keysym = code;
        } else {
            // Unicode beyond Latin-1
            keysym = 0x01000000 + code;
        }

        guac.sendKeyEvent(1, keysym);
        guac.sendKeyEvent(0, keysym);

        i++;
        setTimeout(typeNext, delay);
    }

    typeNext();
}

/**
 * Get X11 keysym for a given character.
 * (kept for potential future use)
 */
function getKeysymForChar(char) {
    var code = char.charCodeAt(0);
    if (code <= 0xFF) return code;
    return 0x01000000 + code;
}

/**
 * Set status text in toolbar.
 */
function setStatus(text) {
    var statusEl = document.getElementById('status-text');
    if (statusEl) {
        statusEl.textContent = text;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Pre-fill form from URL parameters
    initFromUrl();

    // Send clipboard text to remote when user types in clipboard panel
    var clipboardText = document.getElementById('clipboard-text');
    if (clipboardText) {
        clipboardText.addEventListener('input', function() {
            if (guac) {
                var stream = guac.createClipboardStream('text/plain');
                var writer = new Guacamole.StringWriter(stream);
                writer.sendText(clipboardText.value);
                writer.sendEnd();
            }
        });
    }
});
