# WebRDP - slim browser RDP / Hyper-V console client

A minimal web client for **RDP** and **Hyper-V console (vmconnect)** access from a
browser, built on [Apache Guacamole](https://guacamole.apache.org/). No
authentication, no database, no VNC/SSH, no file transfer - just a tunnel to a
desktop or a VM.

Part of the **Open vCenter (ovc)** suite: `ovc-frontend` embeds its
own `guacamole-common-js` client (the VM **Console** tab) and talks to the tunnel
servlet (`/webrdp/tunnel` + `guacd`) directly. The bundled HTML UI works as
a standalone page.

```
┌────────────────┐   WebSocket/HTTP   ┌──────────────┐  Guacamole proto  ┌──────────┐   RDP    ┌──────────────┐
│ Browser        │ ────────────────►  │  webrdp      │ ───────────────►  │  guacd   │ ───────► │ Windows host │
│ guacamole-js   │ ◄────────────────  │  (Tomcat 9)  │ ◄───────────────  │ (FreeRDP)│ ◄─────── │ or Hyper-V VM │
└────────────────┘                    │  :8080       │                   │  :4822   │  3389 /  └──────────────┘
                                      └──────────────┘                   └──────────┘  2179
```

## Features

- **Standard RDP** (port 3389)
- **Hyper-V console (vmconnect)** via preconnection-blob (port 2179, guacd `vmconnect` security mode)
- WebSocket tunnel with HTTP fallback
- Clipboard sync + "type clipboard text" fallback button
- Ctrl+Alt+Del button
- Display auto-scaling, touch support
- `iframe`-embeddable (`Content-Security-Policy: frame-ancestors`, configurable)
- URL parameter pre-fill

## Quick start (Docker Compose)

```bash
docker compose up
```

Open <http://localhost:8080>. Compose pulls the published
`ghcr.io/claudio-azevedo/ovc-webrdp` image and runs it next to a
`guacamole/guacd` container - no local build required. To run a local change
instead, swap the `image:` line in `docker-compose.yml` for `build: ./webrdp`.

## Configuration

| Variable                 | Default     | Description                                                                                                                                           |
| ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEBAPP_CONTEXT`         | `ROOT`      | Tomcat context path. `ROOT` = `/`, `webrdp` = `/webrdp`                                                                                               |
| `GUACD_HOSTNAME`         | `localhost` | guacd address                                                                                                                                         |
| `GUACD_PORT`             | `4822`      | guacd port                                                                                                                                            |
| `WEBRDP_FRAME_ANCESTORS` | `*`         | `Content-Security-Policy: frame-ancestors` value - which origins may embed the app in an `iframe`. Restrict to the ovc-frontend origin in production. |

### URL parameters

Pre-fill the connect form via query string. When `hostname` is present, only
username/password are shown.

| Parameter     | Description                                              |
| ------------- | -------------------------------------------------------- |
| `hostname`    | IP / hostname of the RDP or Hyper-V host                 |
| `port`        | `3389` for RDP, `2179` for vmconnect                     |
| `username`    | User (pre-filled)                                        |
| `domain`      | Windows domain                                           |
| `security`    | `nla`, `tls`, `rdp`, `any`                               |
| `vm-guid`     | VM GUID for vmconnect (preconnection-blob)               |
| `autoconnect` | `true` to connect automatically (password must be typed) |

The password is **never** accepted via URL.

```
# Standard RDP
?hostname=10.0.1.113&port=3389&username=myuser&domain=CORP

# Hyper-V vmconnect
?hostname=HYPERV01&port=2179&vm-guid=b747348c-c90b-4122-bc2d-ef8ceb343c4a&username=myuser
```

## Running on Kubernetes

`deployment-app.yaml` is a ready-to-apply manifest: one Pod with **two
containers** - `guacd` and `webrdp` (sidecar pattern), talking over
`localhost:4822`. A `NodePort` Service (`ovc-webrdp-service-nodeport`, the DNS
name `ovc-frontend` expects for its `/webrdp` proxy) exposes the web app on
port `30080`.

```bash
kubectl apply -f deployment-app.yaml
```

Edit the manifest directly (image tags, namespace, memory limits,
`WEBAPP_CONTEXT`, ...) to fit your own setup. Both images are public.
Liveness/readiness probes hit `/webrdp/`.

## Building from source

Requires **Java 11+** and **Maven 3.6+**.

```bash
cd webrdp
mvn clean package        # -> target/webrdp.war
docker build -t webrdp:latest .
```

## Usage

1. Open the web interface.
2. Pick a **connection type**:
   - **Standard RDP** - Windows/Linux RDP hosts (port 3389)
   - **Hyper-V console (vmconnect)** - VM console access (port 2179)
3. Enter the target **host/IP**, **username**, **password**.
4. For Hyper-V, enter the **VM GUID** (becomes the preconnection-blob) and use the
   Hyper-V **host** credentials.
5. **Connect**.

## Security notes

- The password never appears in logs or the URL; `autocomplete="new-password"`
  discourages the browser from saving it.
- Self-signed RDP certificates are accepted automatically (`ignore-cert=true`).
- Hyper-V vmconnect uses guacd 1.6.0's dedicated `vmconnect` security mode.
- `iframe` embedding is controlled solely by `Content-Security-Policy:
frame-ancestors` (`WEBRDP_FRAME_ANCESTORS`).

There is **no authentication layer** - put WebRDP behind your own
authenticating reverse proxy / the ovc stack, never expose it directly.

## Project layout

```
ovc-webrdp/
├── docker-compose.yml          # local dev (builds ./webrdp + guacd)
├── deployment-app.yaml         # K8s template (guacd + webrdp sidecar Pod)
└── webrdp/
    ├── pom.xml                 # Maven build
    ├── Dockerfile              # multi-stage: Maven -> Tomcat 9
    ├── docker-entrypoint.sh    # deploys the WAR at WEBAPP_CONTEXT
    ├── src/main/java/org/ovc/webrdp/tunnel/
    │   ├── GuacdConfig.java              # reads GUACD_HOSTNAME/PORT
    │   ├── RdpConnectionConfig.java      # builds GuacamoleConfiguration (RDP/vmconnect)
    │   ├── RdpHttpTunnelServlet.java     # HTTP tunnel
    │   ├── RdpWebSocketTunnelEndpoint.java # WebSocket tunnel
    │   ├── ResponseHeaderFilter.java     # iframe / CORS headers
    │   └── WebSocketConfig.java          # registers the WebSocket endpoint
    └── src/main/webapp/
        ├── WEB-INF/web.xml
        ├── index.html
        ├── style.css
        └── app.js
```

## Ports

| Service         | Port | Description              |
| --------------- | ---- | ------------------------ |
| webrdp (Tomcat) | 8080 | web UI + tunnel          |
| guacd           | 4822 | Guacamole protocol       |
| RDP target      | 3389 | standard RDP             |
| Hyper-V host    | 2179 | RDP + preconnection-blob |

## License

[Apache License 2.0](LICENSE).
