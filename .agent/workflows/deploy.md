# Deployment Workflow

Follow these steps to deploy your application to Firebase Hosting.

## Prerequisites
- Node.js installed (you already have this).
- Firebase project created (you already have `car-wash-app-6b0d2`).

## 1. Install Firebase CLI
If you haven't already, install the Firebase command line tools globally:
```bash
npm install -g firebase-tools
```

## 2. Login to Firebase
Authenticate with your Google account:
```bash
firebase login
```

## 3. Initialize Hosting (One-time)
We have already created the configuration files (`firebase.json`, `firestore.rules`), so you might skip the interactive prompts, but running this connects your local folder to the project:
```bash
firebase use car-wash-app-6b0d2
```

## 4. Build and Deploy
We made this simpler. Run this single command to build your app for production and upload it to Firebase:
```bash
// turbo
npm run deploy
```

## 5. Deployment Complete!
The terminal will show you a "Hosting URL" (e.g., `https://car-wash-app-6b0d2.web.app`). You can share this link with anyone.

## Development Cycle: How to update your app?
When you want to change something (e.g., change a color, fix a bug, add a feature):
1. **Develop**: Make your changes in the code (VS Code).
2. **Test**: Run `ng serve` locally to make sure it works.
3. **Deploy**: Run `npm run deploy` again.
   
*Note: Your users will see the changes instantly after you deploy.*

## FAQ: Domains & SSL
- **Do I need to buy a domain?** 
  No. Firebase gives you a free URL: `https://car-wash-app-6b0d2.web.app`.
  If you *want* a professional name (e.g., `tucarwash.com`), you can buy one (approx $12/year from Namecheap/Google) and connect it easily in the Firebase Console.
- **What about SSL (HTTPS)?**
  It is **100% Free and Automatic**. Firebase Hosting includes SSL for both the free subdomain and any custom domain you connect. You don't need to configure anything.
- **Google Premium Benefits?**
  If you have Google One, it doesn't directly affect Firebase. However, the **free "Spark" plan** in Firebase is very generous (GBs of storage/transfer) and perfect for starting without paying anything.
