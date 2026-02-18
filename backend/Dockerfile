# --- Build stage ---
FROM rust:1.88-slim AS builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Cache dependencies by building a stub first
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Build the real source
COPY . .
RUN touch src/main.rs && cargo build --release

# --- Runtime stage ---
FROM amazonlinux:2023
RUN dnf install -y openssl ca-certificates && dnf clean all

WORKDIR /app
COPY --from=builder /app/target/release/missoncontrol ./missoncontrol
COPY entrypoint.sh ./entrypoint.sh
COPY sidecar.sh ./sidecar.sh
RUN chmod +x ./entrypoint.sh ./sidecar.sh

EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
