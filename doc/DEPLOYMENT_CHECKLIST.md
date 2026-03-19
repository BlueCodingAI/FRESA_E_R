# Quick Deployment Checklist

Use this checklist when deploying to Ubuntu server.

## Pre-Deployment

- [ ] Server has Ubuntu 20.04+ installed
- [ ] SSH access configured
- [ ] Domain name pointed to server IP (if using domain)
- [ ] Inworld API key ready (Base64 workspace_id:api_key)
- [ ] OpenAI API key ready (for admin translate buttons)
- [ ] Database credentials ready

## Installation Steps

### 1. System Setup
- [ ] `sudo apt update && sudo apt upgrade -y`
- [ ] Node.js 20.x installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] PostgreSQL installed and running

### 2. Database Setup
- [ ] PostgreSQL service started
- [ ] Database `e_course` created
- [ ] User `e_course_user` created with password
- [ ] Permissions granted

### 3. Audio / Translation Setup
- [ ] `.env` contains `INWORLD_API_KEY`
- [ ] `.env` contains `INWORLD_EN_VOICE_ID` + `INWORLD_RU_VOICE_ID`
- [ ] `.env` contains `OPENAI_API_KEY` (if you want Translate buttons in admin)

### 4. Application Setup
- [ ] Project cloned/uploaded to server
- [ ] `npm install` completed successfully
- [ ] `.env` file created with all variables:
  - [ ] `DATABASE_URL`
  - [ ] `JWT_SECRET` (32+ characters)
- [ ] `INWORLD_API_KEY`
- [ ] `INWORLD_EN_VOICE_ID`
- [ ] `INWORLD_RU_VOICE_ID`
- [ ] `OPENAI_API_KEY` (optional for translate buttons)
  - [ ] `NODE_ENV=production`

### 5. Database Migration
- [ ] `npm run db:generate` completed
- [ ] `npx prisma migrate deploy` completed
- [ ] `npm run db:seed` (optional)
- [ ] Admin user created: `npm run create-super-admin`
- [ ] Audio files mapped: `npm run db:map-audio` (if using existing files)

### 6. Build
- [ ] `npm run build` completed successfully
- [ ] No build errors

### 7. Process Manager
- [ ] PM2 installed globally
- [ ] `ecosystem.config.js` created
- [ ] Application started with PM2
- [ ] PM2 startup configured
- [ ] `pm2 save` executed

### 8. Web Server (Nginx)
- [ ] Nginx installed
- [ ] Site configuration created
- [ ] Site enabled
- [ ] `sudo nginx -t` passed
- [ ] Nginx restarted

### 9. SSL (Optional)
- [ ] Certbot installed
- [ ] SSL certificate obtained
- [ ] Auto-renewal configured

### 10. Firewall
- [ ] UFW enabled
- [ ] Ports 22, 80, 443 allowed
- [ ] Firewall status verified

### 11. Directories
- [ ] `public/audio` created
- [ ] `public/timestamps` created
- [ ] `logs` directory created
- [ ] Permissions set correctly

## Verification

- [ ] Application accessible via browser
- [ ] Homepage loads correctly
- [ ] Admin login works
- [ ] Database connection working
- [ ] Audio generation works (test in admin)
- [ ] Whisper timestamps working (if applicable)
- [ ] PM2 shows app as "online"
- [ ] Nginx serving correctly
- [ ] SSL certificate valid (if configured)

## Post-Deployment

- [ ] Admin user created and tested
- [ ] Initial content seeded (if needed)
- [ ] Backup strategy configured
- [ ] Monitoring setup (PM2 monit)
- [ ] Log rotation configured
- [ ] Security checklist completed

## Quick Commands Reference

```bash
# Check application status
pm2 status
pm2 logs e-course

# Restart application
pm2 restart e-course

# Check services
sudo systemctl status postgresql
sudo systemctl status nginx

# View logs
pm2 logs e-course --lines 50
sudo tail -f /var/log/nginx/error.log

# Database backup
pg_dump -U e_course_user e_course > backup.sql

# Update application
cd /var/www/e_course
git pull
npm install
npm run build
pm2 restart e-course
```

---

**For detailed instructions, see:** `doc/UBUNTU_DEPLOYMENT.md`
