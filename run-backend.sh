#!/usr/bin/env bash
# Starts the API on :8080. Creates the "chakulasmart" database automatically if missing.
cd "$(dirname "$0")/backend" && mvn spring-boot:run
