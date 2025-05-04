$(document).ready(function() {
    const orderListContainer = $('.order-list');
    const filterButtons = $('.filter-button');

    // Function to fetch and render orders
    function fetchAndRenderOrders(statusFilter) {
        orderListContainer.empty(); // Clear previous orders
        orderListContainer.html('<p>Loading orders...</p>'); // Show loading message

        $.ajax({
            url: '/api/drive/orders',
            method: 'POST',
            contentType: 'application/json',
            headers: { // Add Authorization header
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            data: JSON.stringify({ statusFilter: statusFilter }),
            success: function(response) {
                orderListContainer.empty(); // Clear loading message

                if (response.code === 0 && response.orders && response.orders.length > 0) {
                    renderOrders(response.orders);
                } else if (response.code === 0 && response.orders && response.orders.length === 0) {
                    orderListContainer.html('<p>No orders found for this filter.</p>');
                } else {
                    orderListContainer.html('<p>Error loading orders: ' + (response.info || 'Unknown error') + '</p>');
                }
            },
            error: function(xhr, status, error) {
                orderListContainer.html('<p>Error loading orders: ' + (xhr.responseJSON?.info || error) + '</p>');
                console.error('Error fetching orders:', xhr.responseText);
            }
        });
    }

    // Function to render orders in the UI
    function renderOrders(orders) {
        orders.forEach(order => {
            const orderItemHtml = `
                <div class="order-item">
                    <img src="${order.product_image}" alt="${order.product_name}">
                    <div class="order-details">
                        <h4>${order.product_name}</h4>
                        <p>Price: ${order.product_price} USDT</p>
                        <p>Status: ${order.order_status}</p>
                    </div>
                </div>
            `;
            orderListContainer.append(orderItemHtml);
        });
    }

    // Add event listeners to filter buttons
    filterButtons.on('click', function() {
        filterButtons.removeClass('active');
        $(this).addClass('active');
        const statusFilter = $(this).data('status');
        fetchAndRenderOrders(statusFilter);
    });

    // Fetch and render all orders on page load
    fetchAndRenderOrders('all');
});
