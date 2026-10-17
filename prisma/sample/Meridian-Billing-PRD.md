# Meridian Billing Platform — Product Requirements

Owner: Priya Raman (Product) · Version 0.9 · Last updated 12 October 2026

## 1. Purpose
Replace the legacy BillMaster billing system with the Meridian platform so that finance can close the month in 3 days instead of 9, and so that enterprise customers can download their own invoices.

## 2. Timeline
Project start is 7 September 2026. Go-live is 15 March 2027, which is the date we have committed to the finance leadership team. The delivery team is a team of 6 engineers plus one QA analyst.

## 3. Scope
- Migrate all customer accounts, invoices and payment history from BillMaster (about 2.4 million invoice records).
- Self-service invoice download portal for enterprise customers.
- Automated dunning emails for overdue accounts.
- Tax calculation for the EU and UK using the existing tax provider's API.

## 4. Assumptions
We assume the BillMaster export API will remain available and unchanged until after cutover. The tax provider will deliver the sandbox credentials by the end of November. Existing customers will adopt the portal without additional training because it is straightforward to use.

## 5. Non-functional requirements
The portal must support 8,000 concurrent users at the month-end peak. Invoice PDFs must be generated within 5 seconds.
Customer data includes names, billing addresses and email addresses of enterprise contacts.

## 6. Budget
The approved budget for the programme is $350,000 including contingency.
