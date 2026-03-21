# ⚡ **SIMPLEST POWERSHELL COMMANDS**

## 🚀 **You're Already in Backend Folder**

I can see from your prompt: `PS D:\URide\backend>`

---

## **STEP 1: Start Backend (You're Already Here!)**

Just paste this:

```powershell
npm start
```

Press Enter. Wait for: `Server running on port 4000`

---

## **STEP 2: Open NEW PowerShell Window**

`Windows + R` → type `powershell` → Enter

Then paste:

```powershell
cd admin-dashboard; npm run dev
```

Press Enter. Wait for local URL.

---

## **STEP 3: Open NEW PowerShell Window Again**

`Windows + R` → type `powershell` → Enter

Test if backend works:

```powershell
curl http://localhost:4000/api/health
```

Should return: `{"status":"ok"}`

---

## ✅ **If You See That:**

Your app is running! 🎉

---

**Try Step 1 right now!** Just paste: `npm start`
