#!/bin/sh
# Sao lưu database production. Đặt file này ở /opt/oms trên server (Bước 8.10).
set -e
cd /opt/oms
mkdir -p backups
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U oms -d oms | gzip > backups/oms-$(date +%F).sql.gz
# Chỉ giữ 7 bản gần nhất
find backups -name 'oms-*.sql.gz' -mtime +7 -delete
