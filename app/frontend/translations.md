## **Developer Instructions for i18n / Crowdin**

### **1. Request Access**

* Ask the project admin to add you to the Crowdin project.
* Once you have access, generate a **personal API token** in your Crowdin account.

### **2. Add the token to your `.env`**

In the `frontend` folder, create or update `.env` with:

```env
# CROWDIN_PROJECT_ID=849792       # Provided project ID, not needed as this is coded into the crowdin.yml file
CROWDIN_API_TOKEN=<your_personal_api_token>
```

> Keep this file private. Do **not** commit `.env`.

### **3. Install dependencies**

```bash
npm install
```

### **4. Pull translations**

Get the latest translations from Crowdin:

```bash
npm run i18n:pull
```

* This downloads all translations into `src/locales/%two_letters_code%.json`.

### **5. Edit translations**

* Either work locally in the JSON files or directly on Crowdin Web.

### **6. Push new keys**

If you add new source keys to `en.json`, push them to Crowdin:

```bash
npm run i18n:push
```

* Crowdin will update the project with the new strings.

### **7. Stay in sync**

* Regularly pull translations to make sure your local files are up-to-date:

```bash
npm run i18n:pull
```
