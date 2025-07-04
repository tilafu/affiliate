const express = require('express');
const app = express();
app.use(express.json());

// Simple test route to check what the saveOrder payload looks like
app.post('/test-payload', (req, res) => {
    console.log('Received payload:', JSON.stringify(req.body, null, 2));
    
    const { 
        user_active_drive_item_id, 
        product_id, 
        order_amount, 
        product_slot_to_complete 
    } = req.body;

    console.log('Parsed values:');
    console.log('user_active_drive_item_id:', user_active_drive_item_id, typeof user_active_drive_item_id);
    console.log('product_id:', product_id, typeof product_id);
    console.log('order_amount:', order_amount, typeof order_amount);
    console.log('product_slot_to_complete:', product_slot_to_complete, typeof product_slot_to_complete);
    
    // Check validation conditions
    const errors = [];
    
    if (!user_active_drive_item_id) errors.push('Missing user_active_drive_item_id');
    if (!product_id) errors.push('Missing product_id');
    if (order_amount === undefined) errors.push('Missing order_amount');
    if (product_slot_to_complete === undefined) errors.push('Missing product_slot_to_complete');
    
    const parsedUserActiveDriveItemId = parseInt(user_active_drive_item_id);
    const subProductPrice = parseFloat(order_amount);
    const slotIndex = parseInt(product_slot_to_complete);
    
    if (isNaN(parsedUserActiveDriveItemId)) errors.push('Invalid user_active_drive_item_id (not a number)');
    if (isNaN(subProductPrice)) errors.push('Invalid order_amount (not a number)');
    if (isNaN(slotIndex)) errors.push('Invalid product_slot_to_complete (not a number)');
    if (!isNaN(slotIndex) && (slotIndex < 0 || slotIndex > 2)) errors.push('product_slot_to_complete out of range (must be 0-2)');
    
    console.log('Parsed values:');
    console.log('parsedUserActiveDriveItemId:', parsedUserActiveDriveItemId);
    console.log('subProductPrice:', subProductPrice);
    console.log('slotIndex:', slotIndex);
    
    if (errors.length > 0) {
        console.log('Validation errors:', errors);
        return res.status(400).json({ code: 1, info: 'Validation failed: ' + errors.join(', ') });
    }
    
    res.json({ code: 0, info: 'Payload validation passed' });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log('Send POST requests to http://localhost:3001/test-payload to debug saveOrder payloads');
});
