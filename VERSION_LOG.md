# VERSION LOG

## [2026-06-06 01:13:00]
- **Files Changed:**
  - `.env` -> `_backups/.env.backup-2026-06-06-011214`
  - `src/controllers/IndianPhoneCredentialController.js` -> `_backups/src/controllers/IndianPhoneCredentialController.backup-2026-06-06-011214.js`
- **Files Added:**
  - `src/utils/operatorResolver.js`
  - `src/utils/googleSheets.js`
- **Description:** 
  সার্ভারে হিট করা ফোন নম্বরগুলোর অপারেটর কোড, অপারেটর এবং স্টেট সনাক্ত করে গুগল স্প্রেডশিটে স্ব-স্ব নামের ওয়ার্কশিট ট্যাবে তাৎক্ষণিকভাবে পুশ করার লাইভ গুগল শিট ইন্টিগ্রেশন সম্পন্ন করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/.env.backup-2026-06-06-011214" -Destination ".env" -Force
  Copy-Item "_backups/src/controllers/IndianPhoneCredentialController.backup-2026-06-06-011214.js" -Destination "src/controllers/IndianPhoneCredentialController.js" -Force
  Remove-Item "src/utils/operatorResolver.js" -Force
  Remove-Item "src/utils/googleSheets.js" -Force
  ```

## [2026-06-06 02:30:00]
- **Files Changed:**
  - `src/utils/googleSheets.js` -> `_backups/src/utils/googleSheets.backup-2026-06-06-014624.js`
  - `E:\numbar oparetor check\check sorce.txt` -> `_backups/numbar_oparetor_check/check_sorce.backup-2026-06-06-020022.txt`
- **Description:**
  গুগল শিটের ট্যাব নেম ডাইনামিক ফরম্যাটে (যেমন: `Bihar_Jio`, `Bihar_Airtel`) রূপান্তর করা হয়েছে এবং গিটহাবের সোর্স থেকে নতুন ২২০টি প্রিফিক্স এন্ট্রি সংগ্রহ করে মূল ডাটাবেস `check sorce.txt` মার্জ করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/src/utils/googleSheets.backup-2026-06-06-014624.js" -Destination "src/utils/googleSheets.js" -Force
  Copy-Item "_backups/numbar_oparetor_check/check_sorce.backup-2026-06-06-020022.txt" -Destination "E:\numbar oparetor check\check sorce.txt" -Force
  ```

## [2026-06-06 02:55:00]
- **Files Changed:**
  - `E:\numbar oparetor check\check sorce.txt` -> `_backups/numbar_oparetor_check/check_sorce.backup-2026-06-06-025200.txt`
  - `src/utils/googleSheets.js` -> `_backups/src/utils/googleSheets.backup-2026-06-06-025200.js`
- **Description:**
  ভারতের মোবাইল প্রিফিক্স ডাটাবেসকে ৩টি পৃথক নির্ভরযোগ্য উৎস এবং গুগলের গ্লোবাল libphonenumber ডাটাবেসের সাহায্যে ক্রস-রেফারেন্স করে ২৩৪৩টি সচল প্রিফিক্সে (১১৫টি নতুন প্রিফিক্সসহ) উন্নীত করা হয়েছে। এছাড়া অপরিচিত প্রিফিক্সের ক্ষেত্রে গুগল শিটের 'Unknown_Unknown' ট্যাবে অটোমেটিকালি রাউট করার লজিক যুক্ত করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/numbar_oparetor_check/check_sorce.backup-2026-06-06-025200.txt" -Destination "E:\numbar oparetor check\check sorce.txt" -Force
  Copy-Item "_backups/src/utils/googleSheets.backup-2026-06-06-025200.js" -Destination "src/utils/googleSheets.js" -Force
  ```

## [2026-06-06 03:25:00]
- **Files Changed:**
  - `.env` -> `_backups/.env.backup-2026-06-06-032455`
- **Description:**
  গুগল শিট অ্যাপস স্ক্রিপ্টের নতুন ব্যাচিং ডেপ্লয়মেন্টের ওয়েব অ্যাপ ইউআরএল ব্যাকএন্ডের `.env` ফাইলে সফলভাবে আপডেট করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/.env.backup-2026-06-06-032455" -Destination ".env" -Force
  ```

## [2026-06-06 03:35:00]
- **Files Changed:**
  - `deploy.bat` -> `power-automate_backend/_backups/deploy.backup-2026-06-06-033400.bat`
  - `src/utils/operatorResolver.js` -> `_backups/src/utils/operatorResolver.backup-2026-06-06-033400.js`
- **Files Added:**
  - `check sorce.txt` (local copy in project root)
- **Description:**
  `deploy.bat` স্ক্রিপ্ট আপডেট করা হয়েছে যাতে এটি লোকাল `.env` এবং `check sorce.txt` ফাইল দুটিও সার্ভারে উইনএসভিপি (WinSCP) এর মাধ্যমে আপলোড করে। লিনাক্স সার্ভারে যেন ফাইল রিড করতে কোনো এরর না হয়, সেজন্য `operatorResolver.js` এর প্যাথ পোর্টাল করে ব্যাকআপ ফলব্যাক দেওয়া হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "power-automate_backend/_backups/deploy.backup-2026-06-06-033400.bat" -Destination "deploy.bat" -Force
  Copy-Item "_backups/src/utils/operatorResolver.backup-2026-06-06-033400.js" -Destination "src/utils/operatorResolver.js" -Force
  Remove-Item "check sorce.txt" -Force
  ```

## [2026-06-06 04:50:00]
- **Files Changed:**
  - `.env` -> `_backups/.env.backup-2026-06-06-041200`
- **Description:**
  এডিটর ট্রাঙ্কেশন এররের কারণে ক্ষতিগ্রস্ত `.env` ফাইলটি ডিস্কে সম্পূর্ণভাবে রিস্টোর এবং ফিক্স করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/.env.backup-2026-06-06-041200" -Destination ".env" -Force
  ```

## [2026-06-06 06:45:00]
- **Files Changed:**
  - `src/services/cleanupService.js` -> `_backups/src/services/cleanupService.backup-2026-06-06-064542.js`
  - `src/app.js` -> `_backups/src/app.backup-2026-06-06-064542.js`
  - `src/utils/googleSheets.js` -> `_backups/src/utils/googleSheets.backup-2026-06-06-064542.js`
  - `power-automate_fontend/src/pages/superadmin/ValidPhoneNumber.jsx` -> `_backups/power-automate_fontend/src/pages/superadmin/ValidPhoneNumber.backup-2026-06-06-064542.jsx`
  - `power-automate_fontend/src/pages/superadmin/IndianValidPhoneNumber.jsx` -> `_backups/power-automate_fontend/src/pages/superadmin/IndianValidPhoneNumber.backup-2026-06-06-064542.jsx`
- **Files Added:**
  - `src/models/DailyHistory.js`
  - `src/controllers/DailyHistoryController.js`
- **Description:**
  ২৪ ঘণ্টার ব্যবধানে ব্যাকএন্ডে স্বয়ংক্রিয়ভাবে ডাটাবেস থেকে পুরাতন ক্রেডেনশিয়াল মুছে দেওয়ার জন্য `DailyHistory` মডেল ও ক্লিনআপ সার্ভিস চালু করা হয়েছে। এটি প্রতিদিন রাত ১২:০০ টায় গুগলের শিটে স্বয়ংক্রিয়ভাবে বোল্ড সামারি রো তৈরি করবে। এছাড়াও ফ্রন্টএন্ডের দুটি ভ্যালিড ফোন ও পাসওয়ার্ড পেইজে হিস্ট্রি দেখার জন্য ড্রপডাউন যুক্ত করা হয়েছে। পুরাতন সকল ক্রেডেনশিয়াল (৬,২৩৫টি) গুগল শিটের ডুপ্লিকেট হাইলাইটিংসহ সফলভাবে মাইগ্রেট করার জন্য ব্যাচিং ও কনকারেন্সি অপ্টিমাইজড `sync_existing_credentials.js` স্ক্রিপ্ট তৈরি ও রান করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/src/services/cleanupService.backup-2026-06-06-064542.js" -Destination "src/services/cleanupService.js" -Force
  Copy-Item "_backups/src/app.backup-2026-06-06-064542.js" -Destination "src/app.js" -Force
  Copy-Item "_backups/src/utils/googleSheets.backup-2026-06-06-064542.js" -Destination "src/utils/googleSheets.js" -Force
  Copy-Item "_backups/power-automate_fontend/src/pages/superadmin/ValidPhoneNumber.backup-2026-06-06-064542.jsx" -Destination "power-automate_fontend/src/pages/superadmin/ValidPhoneNumber.jsx" -Force
  Copy-Item "_backups/power-automate_fontend/src/pages/superadmin/IndianValidPhoneNumber.backup-2026-06-06-064542.jsx" -Destination "power-automate_fontend/src/pages/superadmin/IndianValidPhoneNumber.jsx" -Force
  Remove-Item "src/models/DailyHistory.js" -Force
  Remove-Item "src/controllers/DailyHistoryController.js" -Force
  ```

## [2026-06-06 07:35:00]
- **Files Changed:**
  - `src/controllers/phoneNumberController.js` -> `_backups/src/controllers/phoneNumberController.backup-2026-06-06-073230.js`
  - `src/controllers/indianNumberController.js` -> `_backups/src/controllers/indianNumberController.backup-2026-06-06-073230.js`
  - `power-automate_fontend/src/api/phoneNumbers.js` -> `_backups/power-automate_fontend/src/api/phoneNumbers.backup-2026-06-06-073237.js`
  - `power-automate_fontend/src/api/indianNumbers.js` -> `_backups/power-automate_fontend/src/api/indianNumbers.backup-2026-06-06-073237.js`
  - `power-automate_fontend/src/pages/superadmin/PhoneNumbers.jsx` -> `_backups/power-automate_fontend/src/pages/superadmin/PhoneNumbers.backup-2026-06-06-073237.jsx`
  - `power-automate_fontend/src/pages/superadmin/IndianNumbers.jsx` -> `_backups/power-automate_fontend/src/pages/superadmin/IndianNumbers.backup-2026-06-06-073237.jsx`
- **Description:**
  ফোন নম্বর এবং ইন্ডিয়ান নম্বর পেজগুলোর রিলোড স্পিড অপ্টিমাইজ করার জন্য ব্যাকএন্ডে স্ট্যাটাস ফিল্টারিং সাপোর্ট যুক্ত করা হয়েছে এবং পাসওয়ার্ড ফরম্যাটার ডাবল-পপুলেশন দূর করা হয়েছে। ফ্রন্টএন্ডে রিকোয়েস্টে ফিল্টার পাঠানো হচ্ছে এবং লোকাল মেমোরি থেকে ফরম্যাটার লেবেল রিজলভ করা হচ্ছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/src/controllers/phoneNumberController.backup-2026-06-06-073230.js" -Destination "src/controllers/phoneNumberController.js" -Force
  Copy-Item "_backups/src/controllers/indianNumberController.backup-2026-06-06-073230.js" -Destination "src/controllers/indianNumberController.js" -Force
  Copy-Item "../power-automate_fontend/_backups/src/api/phoneNumbers.backup-2026-06-06-073237.js" -Destination "../power-automate_fontend/src/api/phoneNumbers.js" -Force
  Copy-Item "../power-automate_fontend/_backups/src/api/indianNumbers.backup-2026-06-06-073237.js" -Destination "../power-automate_fontend/src/api/indianNumbers.js" -Force
  Copy-Item "../power-automate_fontend/_backups/src/pages/superadmin/PhoneNumbers.backup-2026-06-06-073237.jsx" -Destination "../power-automate_fontend/src/pages/superadmin/PhoneNumbers.jsx" -Force
  Copy-Item "../power-automate_fontend/_backups/src/pages/superadmin/IndianNumbers.backup-2026-06-06-073237.jsx" -Destination "../power-automate_fontend/src/pages/superadmin/IndianNumbers.jsx" -Force
  ```

## [2026-06-06 07:44:00]
- **Files Changed:**
  - `power-automate_fontend/src/pages/superadmin/PhoneNumbers.jsx` -> `_backups/power-automate_fontend/src/pages/superadmin/PhoneNumbers.backup-2026-06-06-074355.jsx`
  - `power-automate_fontend/src/pages/superadmin/IndianNumbers.jsx` -> `_backups/power-automate_fontend/src/pages/superadmin/IndianNumbers.backup-2026-06-06-074355.jsx`
- **Description:**
  পাসওয়ার্ড ফরম্যাটার লেবেল রিজলভ করার সময় Temporal Dead Zone (TDZ) সংক্রান্ত ReferenceError এর কারণে পেজ ক্র্যাশ হওয়া ফিক্স করা হয়েছে (ডিক্লেয়ারেশন উপরে সরিয়ে নিয়ে)।
- **How to Revert:**
  ```powershell
  Copy-Item "../power-automate_fontend/_backups/src/pages/superadmin/PhoneNumbers.backup-2026-06-06-074355.jsx" -Destination "../power-automate_fontend/src/pages/superadmin/PhoneNumbers.jsx" -Force
  Copy-Item "../power-automate_fontend/_backups/src/pages/superadmin/IndianNumbers.backup-2026-06-06-074355.jsx" -Destination "../power-automate_fontend/src/pages/superadmin/IndianNumbers.jsx" -Force
  ```

## [2026-06-06 08:05:00]
- **Files Changed:**
  - `power-automate_fontend/src/pages/superadmin/PhoneNumbers.jsx` -> `_backups/power-automate_fontend/src/pages/superadmin/PhoneNumbers.backup-2026-06-06-080547.jsx`
  - `power-automate_fontend/src/pages/superadmin/IndianNumbers.jsx` -> `_backups/power-automate_fontend/src/pages/superadmin/IndianNumbers.backup-2026-06-06-080547.jsx`
- **Description:**
  CountryCodeRow কম্পোনেন্টে passwordFormatters ভেরিয়েবল Props হিসেবে পাস করে স্কোপিংজনিত ReferenceError সমাধান করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "../power-automate_fontend/_backups/src/pages/superadmin/PhoneNumbers.backup-2026-06-06-080547.jsx" -Destination "../power-automate_fontend/src/pages/superadmin/PhoneNumbers.jsx" -Force
  Copy-Item "../power-automate_fontend/_backups/src/pages/superadmin/IndianNumbers.backup-2026-06-06-080547.jsx" -Destination "../power-automate_fontend/src/pages/superadmin/IndianNumbers.jsx" -Force
  ```

## [2026-06-06 08:30:00]
- **Files Changed:**
  - `src/utils/cache.js` -> `_backups/src/utils/cache.backup-2026-06-06-082451.js`
  - `src/models/PhoneCredential.js` -> `_backups/src/models/PhoneCredential.backup-2026-06-06-082451.js`
  - `src/models/IndianPhoneCredential.js` -> `_backups/src/models/IndianPhoneCredential.backup-2026-06-06-082451.js`
  - `src/controllers/PhoneCredentialController.js` -> `_backups/src/controllers/PhoneCredentialController.backup-2026-06-06-082451.js`
  - `src/controllers/IndianPhoneCredentialController.js` -> `_backups/src/controllers/IndianPhoneCredentialController.backup-2026-06-06-082451.js`
  - `src/controllers/phoneNumberController.js` -> `_backups/src/controllers/phoneNumberController.backup-2026-06-06-082451.js`
  - `src/controllers/indianNumberController.js` -> `_backups/src/controllers/indianNumberController.backup-2026-06-06-082451.js`
- **Description:**
  পেজ লোড স্পিড বৃদ্ধির জন্য নম্বর তালিকা পেজসমূহে ইন-মেমোরি ক্যাশিং ফিল্টারিং এবং ক্রেডেনশিয়াল এগ্রিগেশন কোয়েরিতে ক্যাশ ব্যবহারের সুবিধা যুক্ত করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/src/utils/cache.backup-2026-06-06-082451.js" -Destination "src/utils/cache.js" -Force
  Copy-Item "_backups/src/models/PhoneCredential.backup-2026-06-06-082451.js" -Destination "src/models/PhoneCredential.js" -Force
  Copy-Item "_backups/src/models/IndianPhoneCredential.backup-2026-06-06-082451.js" -Destination "src/models/IndianPhoneCredential.js" -Force
  Copy-Item "_backups/src/controllers/PhoneCredentialController.backup-2026-06-06-082451.js" -Destination "src/controllers/PhoneCredentialController.js" -Force
  Copy-Item "_backups/src/controllers/IndianPhoneCredentialController.backup-2026-06-06-082451.js" -Destination "src/controllers/IndianPhoneCredentialController.js" -Force
  Copy-Item "_backups/src/controllers/phoneNumberController.backup-2026-06-06-082451.js" -Destination "src/controllers/phoneNumberController.js" -Force
  Copy-Item "_backups/src/controllers/indianNumberController.backup-2026-06-06-082451.js" -Destination "src/controllers/indianNumberController.js" -Force
  ```

## [2026-06-06 09:07:00]
- **Files Changed:**
  - `src/models/IndianPhoneCredential.js` -> `_backups/src/models/IndianPhoneCredential.backup-2026-06-06-090604.js`
  - `src/models/PhoneCredential.js` -> `_backups/src/models/PhoneCredential.backup-2026-06-06-090604.js`
  - `src/models/PhoneNumber.js` -> `_backups/src/models/PhoneNumber.backup-2026-06-06-090604.js`
  - `src/models/IndianNumber.js` -> `_backups/src/models/IndianNumber.backup-2026-06-06-090604.js`
- **Description:**
  Mongoose মডেল স্কিমাগুলোতে `findOneAndUpdate` এবং `findOneAndDelete` পোস্ট-হুক যুক্ত করা হয়েছে যাতে ব্যাকএন্ড ডেটা আপডেট বা ডিলেট করার পর ইন-মেমোরি ক্যাশ ক্লিয়ার হয় এবং ড্যাশবোর্ডে সঠিক মোট সংখ্যা তাৎক্ষণিকভাবে প্রদর্শিত হয়।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/src/models/IndianPhoneCredential.backup-2026-06-06-090604.js" -Destination "src/models/IndianPhoneCredential.js" -Force
  Copy-Item "_backups/src/models/PhoneCredential.backup-2026-06-06-090604.js" -Destination "src/models/PhoneCredential.js" -Force
  Copy-Item "_backups/src/models/PhoneNumber.backup-2026-06-06-090604.js" -Destination "src/models/PhoneNumber.js" -Force
  Copy-Item "_backups/src/models/IndianNumber.backup-2026-06-06-090604.js" -Destination "src/models/IndianNumber.js" -Force
  ```

## [2026-06-06 09:39:00]
- **Files Changed:**
  - `src/controllers/IndianPhoneCredentialController.js` -> `_backups/src/controllers/IndianPhoneCredentialController.backup-2026-06-06-093741.js`
- **Description:**
  গুগল শিটে একই নম্বর বারবার ডুপ্লিকেট সেভ হওয়া বন্ধ করতে `createCredential` এবং `updateCredential` মেথডে ডাটাবেজ ডুপ্লিকেট এন্ট্রি চেক যুক্ত করা হয়েছে। একই পাসওয়ার্ডের নম্বর অলরেডি ডাটাবেজে উপস্থিত থাকলে গুগল শিটে নতুন কোনো রো পুশ করা হবে না।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/src/controllers/IndianPhoneCredentialController.backup-2026-06-06-093741.js" -Destination "src/controllers/IndianPhoneCredentialController.js" -Force
  ```

## [2026-06-06 09:50:00]
- **Files Changed:**
  - `src/controllers/PhoneCredentialController.js` -> `_backups/src/controllers/PhoneCredentialController.backup-2026-06-06-094945.js`
- **Description:**
  ড্যাশবোর্ডের জেনারেল ভ্যালিড পেজের ডেটাকেও গুগল শিটের সাথে কানেক্ট করা হয়েছে। এখন থেকে জেনারেল পেজে নতুন নম্বর সেভ হওয়ার সাথে সাথে তাও গুগল শিটে পুশ হবে। ডুপ্লিকেট এন্ট্রি চেকও যুক্ত করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/src/controllers/PhoneCredentialController.backup-2026-06-06-094945.js" -Destination "src/controllers/PhoneCredentialController.js" -Force
  ```## [2026-06-06 10:24:00]
- **Files Changed:**
  - `src/utils/googleSheets.js` -> `_backups/src/utils/googleSheets.backup-2026-06-06-102307.js`
  - `src/controllers/PhoneCredentialController.js` -> `_backups/src/controllers/PhoneCredentialController.backup-2026-06-06-102307.js`
- **Description:**
  গুগল শিটে নতুন ৬ কলাম ফরম্যাটে ডেটা পাঠানো এবং সঠিক শিট ট্যাবে রাউট করার জন্য কোড সংশোধন করা হয়েছে। এয়ারটেল নম্বরগুলোর ক্ষেত্রে `${State}_Airtel`, জিও নম্বরের ক্ষেত্রে `GP_CODE` এবং ভোডাফোন/আইডিয়া নম্বরের ক্ষেত্রে `BELL_VF` ট্যাবে ডেটা রাউট হবে। গুগল শিটের ৩ নম্বর কলামে আসল ক্রেডেনশিয়াল টাইপ পাঠানো নিশ্চিত করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/src/utils/googleSheets.backup-2026-06-06-102307.js" -Destination "src/utils/googleSheets.js" -Force
  Copy-Item "_backups/src/controllers/PhoneCredentialController.backup-2026-06-06-102307.js" -Destination "src/controllers/PhoneCredentialController.js" -Force
  ```

## [2026-06-06 11:20:00]
- **Files Changed:**
  - `.env` -> `_backups/.env.backup-2026-06-06-111830`
- **Files Added:**
  - `scratch_sheet_reformatter.js`
- **Description:**
  গুগল স্প্রেডশিটে থাকা সমস্ত পূর্ববর্তী অসঙ্গতিপূর্ণ ডেটা লোকাল ফাইলে ব্যাকআপ নেওয়ার পর অস্থায়ী স্ক্রিপ্ট `scratch_sheet_reformatter.js` দিয়ে সঠিকভাবে নতুন ৬ কলাম লেআউট এবং রাজ্যভিত্তিক সঠিক অপারেটর ট্যাবে (Airtel, Jio, Vi, BSNL) রি-ফরম্যাট করা হয়েছে। এছাড়া ব্যাকএন্ডের `.env` ফাইলে নতুন ডেপ্লয় করা গুগল অ্যাপস স্ক্রিপ্ট ওয়েব অ্যাপ URL আপডেট করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/.env.backup-2026-06-06-111830" -Destination ".env" -Force
  Remove-Item "scratch_sheet_reformatter.js" -Force
  ```

## [2026-06-06 11:55:00]
- **Files Changed:**
  - `src/utils/googleSheets.js` -> `_backups/src/utils/googleSheets.backup-2026-06-06-114400.js`
- **Description:**
  Jio, Vi এবং BSNL নম্বরগুলোকে সরাসরি GP_CODE বা BELL_VF ট্যাবে না পাঠিয়ে, এয়ারটেল নম্বরের মতোই সঠিক রাজ্য ও অপারেটরভিত্তিক ট্যাবে (যেমন: UP(East)_Jio, Gujarat_Jio, UP(East)_BSNL ইত্যাদি) ডাইনামিক রাউটিং এর ব্যবস্থা করা হয়েছে। এছাড়া গুগল স্প্রেডশিটের পূর্ববর্তী ভুলভাবে রাউট হওয়া নম্বরগুলোকেও লোকাল ব্যাকআপ থেকে সঠিক রাজ্যভিত্তিক অপারেটর ট্যাবে রি-ফরম্যাট করে ওভাররাইট করা হয়েছে।
- **How to Revert:**
  ```powershell
  Copy-Item "_backups/src/utils/googleSheets.backup-2026-06-06-114400.js" -Destination "src/utils/googleSheets.js" -Force
  ```


