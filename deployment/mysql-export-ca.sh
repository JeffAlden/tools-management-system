#!/bin/bash
set -e
# MySQL generates its TLS certificates before running initialization scripts.
# Export only the public CA, never the server key or database files.
cp /var/lib/mysql/ca.pem /mysql-ca/ca.pem
chmod 644 /mysql-ca/ca.pem
