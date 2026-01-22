# MyWin App - Hostinger Deployment Guide

## 📋 Prerequisites

ก่อน Deploy ต้องเตรียมสิ่งเหล่านี้:

1. **Hostinger Business Plan** - มี Node.js Web App support ✅  
2. **MySQL Database** - สร้างจาก Hostinger Panel
3. **Redis** - ใช้ Upstash (Free tier) หรือ Redis Cloud

---

## 🚀 Step-by-Step Deployment

### Step 1: เตรียม Database

1. เข้า Hostinger Panel → Databases → MySQL
2. สร้างฐานข้อมูลใหม่:
   - Database name: `mywin_db`
   - Username: `mywin_user`
   - Password: (สร้างรหัสผ่านที่แข็งแรง)
3. จดข้อมูลไว้สำหรับ `.env`

### Step 2: สร้าง Redis Instance (Upstash)

1. ไปที่ [upstash.com](https://upstash.com) และสมัครสมาชิก (Free)
2. สร้าง Redis Database ใหม่:
   - Region: Singapore (ใกล้ที่สุด)
   - Eviction: Enabled
3. Copy Redis URL สำหรับ `.env`

### Step 3: Build Application

```bash
# Install dependencies
npm install

# Build production bundle
npm run build
```

ผลลัพธ์:
- `client_build/` - React Frontend (Static files)
- `dist/` - NestJS Backend (Node.js)

### Step 4: Deploy to Hostinger

1. **ใน Hostinger Panel:**
   - คลิก "+ เพิ่มเว็บไซต์"
   - เลือก "เว็บแอป Node.js"
   - เชื่อมต่อ GitHub Repository หรือ อัปโหลดไฟล์

2. **ตั้งค่า Entry Point:**
   ```
   dist/main.js
   ```

3. **ตั้งค่า Environment Variables:**
   - ไปที่ Settings → Environment Variables
   - เพิ่มทุกตัวแปรจาก `.env.example`

4. **ตั้งค่า Node Version:**
   - เลือก Node.js 18.x หรือ 20.x

### Step 5: Test Deployment

เปิด URL ที่ได้: `https://your-site.hostinger.com`

- ทดสอบ Passenger App: `/#passenger`
- ทดสอบ Driver App: `/#driver`

---

## ⚠️ Important Notes

### Redis Workaround

หาก Hostinger ไม่รองรับ Redis โดยตรง:

**Option A: ใช้ Upstash (Recommended)**
- Free tier: 10,000 commands/day
- ฟรีสำหรับ MVP/Testing

**Option B: Disable Redis Features**
แก้ไข `backend/main.ts`:
```typescript
// Comment out Redis adapter
// const redisIoAdapter = new RedisIoAdapter(app);
// await redisIoAdapter.connectToRedis();
// app.useWebSocketAdapter(redisIoAdapter);
```

### Custom Domain

1. ซื้อโดเมน (เช่น mywin.co.th)
2. Hostinger Panel → Domains → Connect
3. ตั้งค่า DNS records

---

## 📁 Files Structure for Upload

```
mywin-app/
├── dist/              # Backend (NestJS compiled)
│   └── main.js        # Entry point
├── client_build/      # Frontend (React built)
│   └── index.html
├── package.json
├── package-lock.json
└── node_modules/
```

---

## 🔧 Troubleshooting

| ปัญหา | วิธีแก้ |
|-------|--------|
| 502 Bad Gateway | ตรวจสอบ Entry Point ว่าถูกต้อง |
| Database Error | ตรวจสอบ DB_HOST, DB_USER, DB_PASSWORD |
| WebSocket ไม่ทำงาน | ตรวจสอบ Redis URL หรือปิด Redis adapter |
| OTP ไม่ส่ง | ตรวจสอบ SMS API Keys |
