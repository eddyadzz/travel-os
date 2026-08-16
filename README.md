# Maldives Dream Planner

create frontend for this project


create  frontend of this plan 
# Maldives Travel Booking Platform - MVP Plan

## MVP Goal

Reduce travel-agent communication by allowing customers to browse properties, build packages, view estimated pricing, and submit complete booking requests while agents handle only final confirmation.

## Core MVP Modules

### 1. Public Website
- Landing page
- Featured properties
- Search section
- Contact information

### 2. Property Catalogue
Property types:
- Resorts
- Hotels
- Guesthouses
- Safari Boats

Property fields:
- Name
- Type
- Location
- Description
- Gallery
- Amenities
- Transfer information
- Featured status

### 3. Room Management
Each property can have:
- Multiple room types
- Per-room pricing
- Per-person pricing

### 4. Daily Rate Import
Import:
- Excel (.xlsx)
- CSV

Stores:
- Property
- Room Type
- Date Range
- Rate

### 5. Availability Import
Daily inventory upload.

Stores:
- Property
- Room Type
- Date
- Available Units

### 6. Addon Management
Examples:
- Spa Packages
- Romantic Dinners
- Dive Packages
- Transfers
- Excursions

Pricing methods:
- Per Person
- Per Room
- Fixed Amount

### 7. Booking Engine
Customer Flow:
1. Select Property
2. Select Dates
3. Select Guests
4. Select Room
5. Select Addons
6. View Estimated Price
7. Submit Booking Request

Customer Information:
- Name
- Email
- Phone
- Country
- Special Requests

### 8. Pricing Engine
Calculates:
- Accommodation
- Transfers
- Addons
- Extra Guest Charges

Returns:
- Estimated Total

### 9. Agent Dashboard
Manage:
- New Requests
- Confirmed Requests
- Rejected Requests

Actions:
- Confirm
- Modify
- Reject

### 10. Notifications
Customer:
- Booking Request Received

Agent:
- New Booking Request

Optional:
- WhatsApp Notification

## Database Tables

- properties
- rooms
- rates
- availability
- addons
- bookings
- customers

## Recommended Tech Stack

Frontend:
- Next.js
- Tailwind CSS
- shadcn/ui

Backend:
- NestJS

Database:
- PostgreSQL

Storage:
- Cloudflare R2

## Out of Scope (Post-MVP)

- Supplier Portal
- Online Payments
- Hotel APIs
- AI Travel Assistant
- B2B Agent Portal
- Commission Tracking
- Multi-Currency Support

## Success Criteria

Customer:
- Finds property
- Builds package
- Sees pricing
- Submits booking request

Agent:
- Imports rates
- Imports availability
- Receives requests
- Confirms bookings manually

Result:
A semi-automated Maldives travel booking platform that significantly reduces repetitive communication while maintaining agent control over final reservations.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9bd65fcf-3564-4d9f-9244-0f6821d14948).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
