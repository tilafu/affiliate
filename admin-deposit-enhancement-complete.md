# Admin Deposit Management Enhancement

## Overview
Enhanced the admin interface to properly handle both Direct (QR/crypto) and Bank deposits with file attachment support.

## Changes Made

### 1. Admin Interface (admin.html)
- **Added new columns** to deposits table:
  - `ID` column for deposit identification
  - `Type` column to distinguish between "Direct" and "Bank" deposits
  - `Attachments` column for viewing/downloading payment proofs

- **Added CSS styling** for:
  - Deposit attachment buttons (view/download)
  - Deposit type badges (Bank = blue, Direct = primary)
  - Mobile responsive attachment display
  - Modal styling for image/PDF viewing

### 2. Admin JavaScript (admin.js)
- **Enhanced `loadDeposits()` function**:
  - Detects deposit type based on `type` field or presence of `bank_name`
  - Builds attachment buttons for images and PDFs
  - Adds type badges with appropriate icons
  - Shows ID column for easier tracking

- **Added attachment handling functions**:
  - `viewDepositImage()` - Opens images in modal with zoom capability
  - `viewDepositPdf()` - Opens PDFs in modal with iframe
  - `downloadDepositFile()` - Downloads attachments directly

- **Added deposit management functions**:
  - `approveDeposit()` - Calls `/admin/deposits/{id}/approve` API
  - `rejectDeposit()` - Calls `/admin/deposits/{id}/reject` API with reason

- **Added click event handlers** for:
  - Approve deposit buttons
  - Reject deposit buttons
  - Attachment view/download buttons

### 3. User Deposit Forms (deposits.html & deposit.js)
- **Updated bank deposit form** to use real API instead of simulation
- **Added deposit type field** to both direct and bank deposits:
  - Direct deposits: `type: 'direct'`
  - Bank deposits: `type: 'bank'`
- **Enhanced bank deposit submission** with proper file upload handling

## New Features for Admins

### Deposit Type Identification
- **Direct Deposits**: Blue badge with QR code icon
- **Bank Deposits**: Info badge with bank/university icon

### File Attachment Management
- **View Images**: Click image icon to preview in modal
- **View PDFs**: Click PDF icon to view in modal with iframe
- **Download Files**: Click download icon to save file locally
- **File Type Detection**: Automatically detects image vs PDF files

### Approval Workflow
- **Approve Button**: Confirms action and calls approve API
- **Reject Button**: Prompts for reason and calls reject API
- **Status Updates**: Automatically refreshes deposit list after actions

## API Endpoints Expected

### For Admin Actions:
- `POST /admin/deposits/{id}/approve` - Approve a deposit
- `POST /admin/deposits/{id}/reject` - Reject a deposit with reason
- `GET /admin/deposits` - List deposits with type and attachment info

### For User Submissions:
- `POST /api/user/deposit-with-image` - Direct deposit with type field
- `POST /api/user/deposits/bank` - Bank deposit with file upload

## Database Fields Expected

### Deposits Table Should Include:
- `type` - 'direct' or 'bank' 
- `bank_name` - For bank deposits
- `payment_proof` - File path for attachments
- `notes` - Additional notes from user

## File Structure
```
public/
├── admin.html                 # Enhanced admin interface
├── deposits.html             # Updated user deposit forms
└── js/
    ├── admin.js              # Enhanced deposit management
    └── deposit.js            # Updated with type fields
```

## Next Steps
1. **Backend Implementation**: Implement the admin approval/rejection APIs
2. **File Storage**: Ensure proper file upload handling and storage
3. **Database Updates**: Add/update deposit type and attachment fields
4. **Testing**: Test file uploads, approval workflow, and mobile responsiveness

## Benefits
- ✅ Clear distinction between deposit types
- ✅ Easy file viewing and downloading for admins
- ✅ Streamlined approval/rejection workflow
- ✅ Mobile-friendly interface
- ✅ Proper API integration ready for backend
