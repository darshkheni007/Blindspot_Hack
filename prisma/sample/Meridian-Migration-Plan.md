# Meridian Migration and Cutover Plan

Prepared by Daniel Okafor (Engineering Lead)

## Schedule
- Code freeze: 26 February 2027
- UAT: 1 March 2027 to 12 March 2027
- Cutover weekend and go-live: 30 April 2027
- The BillMaster contract ends on 30 April 2027 under the vendor agreement signed in 2024.

## Approach
Data will be exported nightly from BillMaster and loaded into Meridian in three waves (accounts, open invoices, history). The nightly export job is expected to take under two hours. Cutover will happen over a single weekend, and the BillMaster read-only copy will be switched off immediately afterwards.

## Effort estimate
The programme is estimated at 54 person-months of engineering effort.

## Environments
We will run development, staging and production environments. Performance tuning will take place during the last two sprints.

## Risks noted
- The tax provider sandbox may be late.
- Some customer addresses use legacy formats.
