# TODO: Partial Migration to .NET

## Scope (Partial Change)
- [ ] Keep frontend as-is (Next.js).
- [ ] Replace current backend API layer with ASP.NET Core Web API.
- [ ] Keep Python services only for ML/ASR during phase 1.

## Required Changes
- [ ] Create new backend folder: MUIT/backend-dotnet.
- [ ] Add ASP.NET project (controllers, services, DTOs, config).
- [ ] Recreate core routes in .NET: auth, patients, doctors, visits, inventory, health.
- [ ] Add .NET proxy endpoints for ML routes:
	- [ ] POST /generate-emr -> Python service
	- [ ] POST /hindi-summary -> Python service
	- [ ] POST /nvidia-asr/transcribe -> Python service
- [ ] Port DB models to Entity Framework Core + migrations.
- [ ] Configure JWT auth and role policies in .NET.
- [ ] Configure CORS in .NET for localhost:3000.
- [ ] Add appsettings for DB URL, Python ML service URL, JWT secret.

## Frontend/Integration Updates
- [ ] Update Next.js rewrite/base API to point to .NET backend port.
- [ ] Keep Python backend running on a separate internal port for ML calls only.
- [ ] Verify end-to-end flow: login -> patient -> visit -> EMR generation.

## College Submission Checklist
- [ ] Architecture note: "ASP.NET Core primary backend + Python ML microservice (transitional)."
- [ ] API route mapping doc (old route -> new .NET route).
- [ ] Demo script with 3 flows: auth, CRUD, EMR generation.
