# DeepAgents CLI - Server Five Deployment

This deployment configuration sets up DeepAgents CLI on server "five" with Manus remote inspection capabilities for collaborative debugging.

## Architecture

```
Server Five
├── deepagents (container)          # Your DeepAgents CLI instance
│   ├── Interactive shell
│   ├── Snapshots → /data/deepagents/snapshots
│   ├── Logs → /data/deepagents/logs
│   └── Working directory → /repos
│
└── manus-inspector (container)     # Manus inspection service
    ├── API on port 8888
    ├── Read-only access to snapshots/logs
    └── Debug package generation
```

## Quick Start

### 1. Initial Setup

```bash
# Navigate to deployment directory
cd deployment/server-five

# Create .env file
cp .env.example .env

# Edit .env and add your API keys
nano .env
```

### 2. Deploy

```bash
# Run deployment script
./deploy.sh
```

### 3. Use DeepAgents CLI

```bash
# Enter DeepAgents container
docker-compose exec deepagents bash

# Inside container
cd /repos/your-project
deepagents next
deepagents ask "What should I work on?"
```

## Collaborative Debugging Workflow

### Your Workflow

1. **Use DeepAgents normally**
   ```bash
   docker-compose exec deepagents bash
   cd /repos/your-project
   deepagents ask "Setup new project"
   ```

2. **When something goes wrong**
   - Note the issue (invalid tool use, unexpected behavior, etc.)
   - Execution state is automatically captured in snapshots

3. **Give Manus access**
   - Ensure port 8888 is accessible (you handle firewall)
   - Provide Manus with server IP and port
   - Example: `http://your-server-five-ip:8888`

4. **Manus inspects remotely**
   - Reviews recent executions
   - Analyzes snapshots
   - Identifies root cause
   - Suggests fixes

5. **Apply fixes**
   - Update prompts in `deepagents/prompts/`
   - Modify tool implementations if needed
   - Rebuild: `docker-compose build deepagents`
   - Restart: `docker-compose restart deepagents`

6. **Continue testing**
   - Test the fix
   - Repeat if needed

### Manus Workflow

When you provide access, Manus can:

1. **Check system status**
   ```bash
   curl http://your-server:8888/api/status
   ```

2. **Review recent executions**
   ```bash
   curl http://your-server:8888/api/executions/recent?limit=20
   ```

3. **Inspect specific snapshot**
   ```bash
   curl http://your-server:8888/api/snapshot/snapshot_20251126_143022.json
   ```

4. **Get analysis summary**
   ```bash
   curl http://your-server:8888/api/analysis/summary
   ```

5. **Create debug package**
   ```bash
   curl -X POST http://your-server:8888/api/debug-package/create \
     -H "Content-Type: application/json" \
     -d '{"description": "Tool X failed with error Y"}'
   ```

6. **Download debug package**
   ```bash
   curl -O http://your-server:8888/api/debug-package/download/debug_package_20251126.tar.gz
   ```

## Manus Inspector API Endpoints

### Status and Health

- `GET /health` - Health check
- `GET /api/status` - System status and configuration
- `GET /` - API documentation

### Execution Inspection

- `GET /api/executions/recent?limit=20` - Recent executions summary
- `GET /api/snapshot/{filename}` - Get specific snapshot details
- `GET /api/snapshot/{filename}/download` - Download snapshot file
- `GET /api/analysis/summary` - Analysis of recent executions

### Logs

- `GET /api/logs/list` - List available log files
- `GET /api/logs/{filename}?lines=100` - Get log content (optionally last N lines)

### Debug Packages

- `POST /api/debug-package/create` - Create comprehensive debug package
- `GET /api/debug-package/download/{filename}` - Download debug package

## Data Locations

All data is stored in `/data/deepagents/`:

```
/data/deepagents/
├── snapshots/              # Execution snapshots (JSON)
├── logs/                   # Application logs
├── debug-packages/         # Generated debug packages
└── deepagents.db          # SQLite database (if using SQLite)
```

## Common Operations

### View Logs

```bash
# View DeepAgents logs
docker-compose logs -f deepagents

# View Manus inspector logs
docker-compose logs -f manus-inspector
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart deepagents
```

### Update Deployment

```bash
# Pull latest code
git pull

# Rebuild images
docker-compose build

# Restart services
docker-compose up -d
```

### Backup Data

```bash
# Backup all data
sudo tar -czf deepagents-backup-$(date +%Y%m%d).tar.gz /data/deepagents/

# Backup just snapshots
sudo tar -czf snapshots-backup-$(date +%Y%m%d).tar.gz /data/deepagents/snapshots/
```

### Clean Up Old Snapshots

```bash
# Keep only last 100 snapshots
cd /data/deepagents/snapshots
ls -t snapshot_*.json | tail -n +101 | xargs rm -f
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs deepagents
docker-compose logs manus-inspector

# Verify environment
docker-compose config

# Check data directory permissions
ls -la /data/deepagents
```

### Can't Access Manus Inspector

```bash
# Check if service is running
docker-compose ps manus-inspector

# Test locally
curl http://localhost:8888/health

# Check firewall (you handle this)
# Ensure port 8888 is open for Manus access
```

### Out of Disk Space

```bash
# Check disk usage
df -h /data

# Clean old snapshots
find /data/deepagents/snapshots -name "snapshot_*.json" -mtime +7 -delete

# Clean old logs
find /data/deepagents/logs -name "*.log" -mtime +30 -delete

# Clean old debug packages
find /data/deepagents/debug-packages -name "*.tar.gz" -mtime +7 -delete
```

### DeepAgents Behaving Incorrectly

1. **Export debug package**
   ```bash
   docker-compose exec deepagents deepagents export-debug "Description of issue"
   ```

2. **Or use Manus inspector API**
   ```bash
   curl -X POST http://localhost:8888/api/debug-package/create
   ```

3. **Give Manus access to inspect**
   - Provide server IP and port 8888
   - Manus will analyze and suggest fixes

4. **Apply fixes to prompts/tools**
   ```bash
   # Edit files in deepagents/prompts/ or deepagents/tools/
   nano ../../deepagents/prompts/system_prompt.md
   
   # Rebuild
   docker-compose build deepagents
   
   # Restart
   docker-compose restart deepagents
   ```

## Security Considerations

1. **API Keys** - Stored in .env file, not committed to git
2. **Firewall** - You control access to port 8888
3. **Read-only Access** - Manus inspector has read-only access to snapshots/logs
4. **SSH Keys** - Mounted read-only for git operations
5. **Data Isolation** - Each service runs in isolated container

## Integration with Existing Services

This deployment follows the same pattern as other services in `RAN/Services/`:

- Uses `/data/` for persistent storage
- Follows standard docker-compose structure
- Restart policy: `unless-stopped`
- Environment-based configuration

## Next Steps

1. ✅ Deploy to server five: `./deploy.sh`
2. ✅ Test basic operations: `deepagents next`
3. ✅ Configure firewall for port 8888
4. ✅ Test Manus inspector access
5. ✅ Start using DeepAgents for your workflows

## Support

For issues with:
- **Deployment**: Check logs and this README
- **DeepAgents behavior**: Use Manus inspector for collaborative debugging
- **Manus access**: Ensure firewall allows port 8888

## Example Session

```bash
# 1. Deploy
cd deployment/server-five
./deploy.sh

# 2. Enter DeepAgents
docker-compose exec deepagents bash

# 3. Use DeepAgents
cd /repos/my-project
deepagents next
deepagents ask "Setup new project with README and structure"

# 4. If something goes wrong
deepagents export-debug "Setup command created wrong structure"

# 5. Give Manus access (from another terminal)
# Manus can now access: http://your-server-five:8888

# 6. Manus inspects remotely
curl http://your-server-five:8888/api/executions/recent
curl http://your-server-five:8888/api/analysis/summary

# 7. Apply fixes suggested by Manus
exit  # Exit container
nano ../../deepagents/prompts/system_prompt.md
docker-compose build deepagents
docker-compose restart deepagents

# 8. Test again
docker-compose exec deepagents bash
cd /repos/my-project
deepagents ask "Setup new project with README and structure"
```

This workflow enables rapid iteration and debugging with Manus's help!
