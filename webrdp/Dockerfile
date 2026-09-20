# Stage 1: Build the WAR file
FROM maven:3.9-eclipse-temurin-11 AS builder

# The build resolves everything from Maven Central, so the image builds on any
# machine with plain internet access.
WORKDIR /build
COPY pom.xml ./

# Download dependencies first (cache layer)
RUN mvn dependency:resolve dependency:resolve-plugins

COPY src/ src/
RUN mvn package -DskipTests \
    && jar tf target/webrdp.war | grep "WEB-INF/lib" | head

# Stage 2: Run on Tomcat 9 (uses javax.servlet API - required by guacamole-common)
# IMPORTANT: Tomcat 10+ uses jakarta.servlet and is NOT compatible with guacamole-common 1.6.0
FROM tomcat:9-jdk11-temurin-jammy

LABEL org.opencontainers.image.source=https://github.com/claudio-azevedo/Open-vCenter-WebRDP
LABEL org.opencontainers.image.description="Open vCenter WEBRDP"
LABEL org.opencontainers.image.licenses=APACHE-2.0

# Remove default webapps
RUN rm -rf /usr/local/tomcat/webapps/*

# Environment variables
# WEBAPP_CONTEXT: context path where the app is served
#   - ROOT      -> /
#   - webrdp    -> /webrdp  (what the ovc suite uses, behind a single-domain proxy)
# GUACD_HOSTNAME / GUACD_PORT: where the guacd daemon lives
# WEBRDP_FRAME_ANCESTORS: CSP frame-ancestors value controlling who may iframe this
#   app. Default "*" (any origin); set to e.g. "https://ovc.example.net" to lock it
#   down to the ovc-frontend origin.
ENV WEBAPP_CONTEXT=ROOT
ENV GUACD_HOSTNAME=localhost
ENV GUACD_PORT=4822
ENV WEBRDP_FRAME_ANCESTORS=*

# Copy the WAR file and set up context deployment via entrypoint
COPY --from=builder /build/target/webrdp.war /usr/local/tomcat/webrdp.war

# Custom entrypoint to handle WEBAPP_CONTEXT
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Increase max header size for load balancer compatibility (default 8KB -> 32KB)
RUN sed -i 's/Connector port="8080"/Connector port="8080" maxHttpHeaderSize="32768"/' /usr/local/tomcat/conf/server.xml

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["catalina.sh", "run"]
