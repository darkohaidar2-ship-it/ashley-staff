const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '..', 'src', 'locales', 'en.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const keys = [
  "data_management_desc",
  "done",
  "waiting",
  "request_deleted",
  "request_for_model_deleted",
  "request_updated",
  "request_for_model_updated",
  "edit_request",
  "confirm_delete_request",
  "no_requests_for_month"
];

const results = {};
keys.forEach(k => {
  results[k] = en[k];
});

console.log(JSON.stringify(results, null, 2));
