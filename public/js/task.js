// Ensure API_BASE_URL and showNotification are available (assuming from main.js)
// If not, define them here or ensure main.js is loaded first.

// --- Global Variables (from embedded script) ---
var has_member_address = "0"; // Keep? Purpose unclear from context.
var cid = "1"; // Keep? Purpose unclear.
var oid = null; // Will be set by startDrive response if needed (using session ID?)
var add_id = ''; // Keep? Purpose unclear.
var m = 0; // Keep? Purpose unclear.
// var audio = document.getElementById("audio"); // Audio element commented out in HTML

// --- Initialization ---
function initializeTaskPage() {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    // Use showNotification if available, otherwise alert
    if (typeof showNotification === 'function') {
        showNotification('Authentication token not found. Redirecting to login.', 'error');
    } else {
        alert('Authentication token not found. Redirecting to login.');
    }
    window.location.href = 'login.html';
    return false; // Indicate initialization failed
  }

  // Fetch user balance initially
  fetchBalance(token);

  // --- Event Listeners ---
  // Attach listener for the Start button
  const autoStartButton = document.getElementById('autoStart');
  if (autoStartButton) {
      console.log("Found #autoStart button, attaching listener.");
      autoStartButton.addEventListener('click', () => {
          console.log("#autoStart button clicked.");
          // Check if button is already processing? Maybe add a state check.
          autoStartButton.querySelector('span').textContent = 'Data Drive'; // Update button text more specifically
          startDriveProcess(token); // Start the drive process
      });
  } else {
      console.error('Could not find #autoStart button to attach listener.');
  }

  // Event delegation for dynamically added submit buttons in popups
  // Using document.body ensures the listener works even if #order2 is populated later
  document.body.addEventListener('click', function(event) {
      if (event.target && event.target.id === 'submitOrder') {
          console.log("#submitOrder button clicked.");
          submitSingleOrder(token);
      }
      if (event.target && event.target.id === 'submitCombo') {
          console.log("#submitCombo button clicked.");
          submitComboOrder(token);
      }
  });

  // TODO: Add logic for the p_pp interval if still needed? Its purpose was unclear.
  /*
  setInterval(function () {
      $('.p_pp').each(function (i) {
         // ... original interval logic ...
      });
   }, 2500);
   */
   return true; // Indicate successful initialization
}

// --- Wait for DOM and potentially components before initializing ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTaskPage);
} else {
    // DOM is already ready, initialize now
    initializeTaskPage();
}

// Optional: If sidebar loading might interfere, wait for it specifically.
// Commented out for now as DOMContentLoaded should usually suffice.
/*
let sidebarLoaded = false;
const sidebarPlaceholder = document.getElementById('sidebar-placeholder');

if (sidebarPlaceholder) {
    sidebarPlaceholder.addEventListener('componentLoaded', (event) => {
        if (event.detail.path === '/components/sidebar.html') {
            console.log('Sidebar component loaded event received by task.js.');
            sidebarLoaded = true;
            // Ensure initialization happens only once and if DOM is ready
            if (document.readyState !== 'loading' && typeof taskPageInitialized === 'undefined') {
                 window.taskPageInitialized = initializeTaskPage();
            }
        }
    });
} else {
    // No sidebar placeholder, assume it's not needed or loaded differently
    sidebarLoaded = true;
}

// Initialize after DOM ready AND sidebar loaded (if applicable)
document.addEventListener('DOMContentLoaded', () => {
    if (sidebarLoaded && typeof taskPageInitialized === 'undefined') {
         window.taskPageInitialized = initializeTaskPage();
    }
});

// Fallback if DOM ready but sidebar event hasn't fired (e.g., if component loads instantly)
if (document.readyState !== 'loading' && sidebarLoaded && typeof taskPageInitialized === 'undefined') {
     window.taskPageInitialized = initializeTaskPage();
}
*/

// --- Balance Fetch Function ---
function fetchBalance(token) {
    fetch(`${API_BASE_URL}/api/user/balance`, { // Use API_BASE_URL from main.js
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
          if (data.success) {
            // Update the data drive balance
            const balanceElements = document.querySelectorAll('.datadrive-balance');
            balanceElements.forEach(elem => {
              elem.textContent = `${data.balance.toFixed(2)}`;
            });
          } else {
            console.error('Failed to fetch balance:', data.message);
            if (typeof showNotification === 'function') {
                showNotification(`Failed to fetch balance: ${data.message}`, 'error');
            }
          }
        })
        .catch(error => {
          console.error('Error fetching balance:', error);
           if (typeof showNotification === 'function') {
                showNotification(`Error fetching balance: ${error.message}`, 'error');
            }
        });
}

// --- Audio Functions (from embedded script, if needed) ---
/*
function palySong(wi) {
  // ... original audio logic ...
}
function stopSong() {
  // ... original audio logic ...
}
*/

// --- Random Sum Helper (from embedded script) ---
function randomSum(min, max) {
  var num = Math.floor(Math.random()*(max - min) + min);
  return num;
}

// --- Drive Animation/Start Logic (from embedded script) ---
let countDown = 5; // Reset countdown for each start attempt
let pictureItemNum = $(".p_picture-item").length; // Requires jQuery
let pictureItemNumEveryList = pictureItemNum > 0 ? pictureItemNum / 3 : 0; // Avoid division by zero
let pictureItemHeight = pictureItemNum > 0 ? $('.p_picture-item').eq(0).height() : 0; // Requires jQuery
let pictureItemMaxOffset = pictureItemNumEveryList > 1 ? (pictureItemNumEveryList - 1) * pictureItemHeight : 0;

function startDriveProcess(token) {
    countDown = 5; // Reset countdown
    pictureItemNum = $(".p_picture-item").length; // Recalculate in case DOM changed
    pictureItemNumEveryList = pictureItemNum > 0 ? pictureItemNum / 3 : 0;
    pictureItemHeight = pictureItemNum > 0 ? $('.p_picture-item').eq(0).height() : 0;
    pictureItemMaxOffset = pictureItemNumEveryList > 1 ? (pictureItemNumEveryList - 1) * pictureItemHeight : 0;
    animateAndStart(token); // Start the animation loop
}

function animateAndStart(token) {
    if (countDown <= 0) {
        // Animation finished, call the backend to start the drive
        callStartDriveAPI(token);
        // Reset animation transforms
        $('.p_picture-list').eq(0).css('transform', `translate(0px, 0px)`);
        $('.p_picture-list').eq(1).css('transform', `translate(0px, 0px)`);
        $('.p_picture-list').eq(2).css('transform', `translate(0px, 0px)`);
    } else {
        // Animate
        if (pictureItemMaxOffset > 0) {
            let tt1 = randomSum(1, pictureItemMaxOffset) * -1;
            $('.p_picture-list').eq(0).css('transform', 'translate(0px, '+tt1+'px)');
            let tt2 = randomSum(1, pictureItemMaxOffset) * -1;
            $('.p_picture-list').eq(1).css('transform', 'translate(0px, '+tt2+'px)');
            let tt3 = randomSum(1, pictureItemMaxOffset) * -1;
            $('.p_picture-list').eq(2).css('transform', 'translate(0px, '+tt3+'px)');
        }
        countDown--;
        setTimeout(() => animateAndStart(token), 1000); // Continue animation
    }
}

function callStartDriveAPI(token) {
    // Use the layer/dialog library for loading indicator
    let loading;
    if (typeof layer !== 'undefined') {
        loading = layer.load(2); // Show loading icon type 2
    } else if (typeof $(document).dialog === 'function') {
         loading = $(document).dialog({ // Fallback to jQuery dialog if layer not present
            type: 'notice',
            // infoIcon: baseurl + '/assets/frontend/shopva/img/loading.gif', // baseurl not defined
            infoText: 'Starting Data Drive...',
            autoClose: 0
         });
    } else {
        console.log("Starting Data Drive..."); // Console fallback
    }


    fetch(`${API_BASE_URL}/api/drive/start`, { // Use local API endpoint
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`, // Use JWT token
            'Content-Type': 'application/json'
        },
        // No body needed for start based on controller
    })
    .then(response => response.json())
    .then(data => {
        // Close loading indicator
        if (typeof layer !== 'undefined') {
            layer.close(loading);
        } else if (loading && typeof loading.close === 'function') {
            loading.close();
        }

        $('#autoStart').text('Start'); // Reset button text

        if (data.code === 0) { // Success code from backend
             if (typeof $(document).dialog === 'function') {
                $(document).dialog({infoText: data.info || 'Drive started!', autoClose: 2000});
             } else {
                alert(data.info || 'Drive started!');
             }
            // sessionStorage.setItem('oid', data.oid); // Store session ID if backend provides it
            fetchNextOrder(token); // Fetch the first order
            // oid = data.oid; // Store session ID if needed globally
            // add_id = data.add_id; // Store if needed globally
        } else {
            // Handle error (code 1 or other)
             if (typeof $(document).dialog === 'function') {
                $(document).dialog({infoText: data.info || 'Failed to start drive.', autoClose: 4000});
             } else {
                 alert(data.info || 'Failed to start drive.');
             }
        }
    })
    .catch(error => {
        console.error('Error starting drive:', error);
         if (typeof layer !== 'undefined') {
            layer.close(loading);
        } else if (loading && typeof loading.close === 'function') {
            loading.close();
        }
        $('#autoStart').text('Start'); // Reset button text
         if (typeof $(document).dialog === 'function') {
            $(document).dialog({infoText: `Error starting drive: ${error.message}`, autoClose: 4000});
         } else {
             alert(`Error starting drive: ${error.message}`);
         }
    });
}


// --- Fetching Order/Combo Logic (from embedded script) ---
function fetchNextOrder(token) {
    // Show loading indicator?
    console.log("Fetching next order...");
    fetch(`${API_BASE_URL}/api/drive/getorder`, { // Use local API endpoint
        method: 'POST', // Changed to POST as per route definition
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        // No body needed for getorder based on controller
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (data.premium_status == 0) { // Single product order
                updateOrderBox(data); // Populate the single order dialog
                console.log("Single product order received", data);
            } else if (data.premium_status == 1) { // Combo order
                updateComboBox(data); // Populate the combo order dialog
                console.log("Combo order received", data);
            } else {
                 console.error('Unknown premium_status:', data.premium_status);
                 if (typeof $(document).dialog === 'function') {
                    $(document).dialog({infoText: 'Received unknown order type.', autoClose: 3000});
                 }
            }
        } else {
            console.error('Error fetching next order:', data.message);
             if (typeof $(document).dialog === 'function') {
                $(document).dialog({infoText: `Error fetching order: ${data.message || 'Unknown error'}`, autoClose: 3000});
             }
        }
    })
    .catch(error => {
        console.error('Error fetching next order:', error);
         if (typeof $(document).dialog === 'function') {
            $(document).dialog({infoText: `Network error fetching order: ${error.message}`, autoClose: 3000});
         }
    });
}

// --- UI Update Functions (from embedded script) ---
function updateOrderBox(orderData) {
    // This function generates HTML for the single order popup.
    // It uses jQuery selectors $('#order1'), $('#order2').
    // Keep the original logic but ensure IDs match the HTML.
    $('#order1').show(); // Show overlay
    $('#order2').show(); // Show dialog popup

    // Ensure all data properties exist before accessing
    const productId = orderData.product_id ?? 'N/A';
    const productName = orderData.product_name ?? 'Unknown Product';
    const productPrice = orderData.product_price !== undefined ? parseFloat(orderData.product_price).toFixed(2) : '0.00';
    const fundAmount = orderData.fund_amount !== undefined ? parseFloat(orderData.fund_amount).toFixed(2) : '0.00'; // Usually same as price
    const productNumber = orderData.product_number ?? 'N/A';
    const orderCommission = orderData.order_commission !== undefined ? parseFloat(orderData.order_commission).toFixed(2) : '0.00';
    const grabbedDate = orderData.grabbed_date ? new Date(orderData.grabbed_date).toLocaleString() : 'N/A';
    const productImage = orderData.product_image || './assets/uploads/products/newegg-1.jpg'; // Default image

    var orderBoxContent = `
       <div class="van-dialog__header">
          <div data-v-e38e2d82="" class="text-lg">Order Task Submission</div>
          <p id="product-id" hidden>${productId}</p>
          <p id="product-price" hidden>${productPrice}</p>
          <p id="fund-amount" hidden>${fundAmount}</p>
          <p id="product-number" hidden>${productNumber}</p>
          <p id="order-commission" hidden>${orderCommission}</p>
       </div>
       <div class="van-dialog__content">
         <div data-v-e38e2d82="" class="flex flex-col p-3 box-border mt-3">
           <div data-v-e38e2d82="" class="flex border-b-[1px] border-[#e5e7eb] pb-2">
             <div data-v-e38e2d82="" class="mr-4" style="width: 6rem;">
               <div data-v-e38e2d82="" class="van-image" style="width: 6rem; height: 6rem; overflow: hidden; border-radius: 0.4rem;">
                 <img class="van-image__img" src="${productImage}" lazy="loaded" style="object-fit: cover;">
               </div>
             </div>
             <div data-v-e38e2d82="" class="flex flex-col h-[6rem] justify-between">
               <div data-v-e38e2d82="" class="flex flex-col">
                 <div data-v-e38e2d82="" class="text-[#666] w-44 whitespace-nowrap overflow-hidden text-ellipsis text-sm font-semibold">${productName}</div>
                 <div data-v-e38e2d82="" class="text-[#666] text-sm mt-2 font-semibold">${productPrice} USDT</div>
               </div>
               <div data-v-e38e2d82="" role="radiogroup" class="van-rate van-rate--readonly" tabindex="0" aria-disabled="false" aria-readonly="true">
                 </div>
             </div>
           </div>
           <div data-v-e38e2d82="" class="flex items-center pt-2 pb-2 box-border border-b-[1px] border-[#e5e7eb]">
             <div data-v-e38e2d82="" class="w-[50%] flex flex-col border-r-[1px] border-[#e5e7eb] justify-center items-center">
               <div data-v-e38e2d82="" class="text-[#333] font-semibold">Total Amount</div>
               <div data-v-e38e2d82="" class="text-xs text-[#999] mt-1">USDT <span data-v-e38e2d82="" class="text-sm text-[var(--main-color)] font-semibold">${productPrice}</span></div>
             </div>
             <div data-v-e38e2d82="" class="w-[50%] flex flex-col justify-center items-center">
               <div data-v-e38e2d82="" class="text-[#333] font-semibold">Profit</div>
               <div data-v-e38e2d82="" class="text-xs text-[#999] mt-1">USDT <span data-v-e38e2d82="" class="text-sm text-[var(--main-color)] font-semibold">${orderCommission}</span></div>
             </div>
           </div>
           <div data-v-e38e2d82="" class="flex justify-between items-center pt-3 pb-2 box-border border-b-[1px] border-[#e5e7eb]">
             <div data-v-e38e2d82="" class="text-[#666] text-sm">Created At</div>
             <div data-v-e38e2d82="" class="text-[#333] text-sm font-bold">${grabbedDate}</div>
           </div>
           <div data-v-e38e2d82="" class="flex justify-between items-center pt-3 pb-2 box-border border-b-[1px] border-[#e5e7eb]">
             <div data-v-e38e2d82="" class="whitespace-nowrap text-[#666] text-sm">Task Code</div>
             <div data-v-e38e2d82="" class="text-[var(--main-color)] text-xs font-bold">${productNumber}</div>
           </div>
           <div data-v-e38e2d82="" class="w-full mt-4">
             <button data-v-e38e2d82="" type="button" class="van-button van-button--default van-button--large van-button--round" id="submitOrder" style="color: white; background: var(--btn-color); border-color: var(--btn-color);">
               <div class="van-button__content">
                 <span class="van-button__text"><span data-v-e38e2d82="" class="font-semibold text-white">Submit</span></span>
               </div>
             </button>
           </div>
         </div>
       </div>
       <div class="van-hairline--top van-dialog__footer">
       </div>
    `;
    $('#order2').html(orderBoxContent); // Set the dialog content

    // Note: The click handler for #submitOrder is now delegated in DOMContentLoaded
}

function updateComboBox(comboData) {
    // This function generates HTML for the combo order popup.
    // It uses jQuery selectors $('#order1'), $('#order2').
    // Keep the original logic but ensure IDs match the HTML.
    $('#order1').show();
    $('#order2').show();

    const productNumber = comboData.product_number ?? 'N/A';
    const totalCombos = comboData.total_combos ?? 0;
    const totalPrice = comboData.total_price !== undefined ? parseFloat(comboData.total_price).toFixed(2) : '0.00';
    const totalCommission = comboData.total_commission !== undefined ? parseFloat(comboData.total_commission).toFixed(2) : '0.00';
    const grabbedDate = comboData.grabbed_date ? new Date(comboData.grabbed_date).toLocaleString() : 'N/A';

    var comboBoxContent = `
    <div class="van-dialog__header">
        <div data-v-e38e2d82="" class="text-lg">Order Task Submission</div>
        <p id="order-amount" hidden>${totalPrice}</p>
        <p id="product-number" hidden>${productNumber}</p>
        <p id="order-commission" hidden>${totalCommission}</p>
        <p id="total-combos" hidden>${totalCombos}</p>
        `;
        // Add hidden fields for each product in the combo
        (comboData.products || []).forEach(function(product, index) {
            comboBoxContent += `
                <p id="combo-id-${index}" hidden>${product.combo_id ?? 'N/A'}</p>
                <p id="product-id-${index}" hidden>${product.product_id ?? 'N/A'}</p>
                <p id="product-price-${index}" hidden>${product.product_price !== undefined ? parseFloat(product.product_price).toFixed(2) : '0.00'}</p>
                <p id="product-commission-${index}" hidden>${product.product_commission !== undefined ? parseFloat(product.product_commission).toFixed(2) : '0.00'}</p>
            `;
        });
    comboBoxContent += `</div>
    <div class="van-dialog__content">
        <div data-v-e38e2d82="" class="flex flex-col p-3 box-border mt-3">
    `;
    (comboData.products || []).forEach(function(product) {
        const productName = product.product_name ?? 'Unknown Product';
        const productPrice = product.product_price !== undefined ? parseFloat(product.product_price).toFixed(2) : '0.00';
        const productImage = product.product_image || './assets/uploads/products/newegg-1.jpg'; // Default image

        comboBoxContent += `
            <div data-v-e38e2d82="" class="flex border-b-[1px] border-[#e5e7eb] pb-2 mb-2">
                <div data-v-e38e2d82="" class="mr-4" style="width: 6rem;">
                    <div data-v-e38e2d82="" class="van-image" style="width: 6rem; height: 6rem; overflow: hidden; border-radius: 0.4rem;">
                        <img class="van-image__img" src="${productImage}" lazy="loaded" style="object-fit: cover;">
                    </div>
                </div>
                <div data-v-e38e2d82="" class="flex flex-col h-[6rem] justify-between">
                    <div data-v-e38e2d82="" class="flex flex-col">
                        <div data-v-e38e2d82="" class="text-[#666] w-44 whitespace-nowrap overflow-hidden text-ellipsis text-sm font-semibold">${productName}</div>
                        <div data-v-e38e2d82="" class="text-[#666] text-sm mt-2 font-semibold">${productPrice} USDT</div>
                    </div>
                    <div data-v-e38e2d82="" role="radiogroup" class="van-rate van-rate--readonly" tabindex="0" aria-disabled="false" aria-readonly="true">
                        </div>
                </div>
            </div>
        `;
    });
    comboBoxContent += `
        <div data-v-e38e2d82="" class="flex items-center pt-2 pb-2 box-border border-b-[1px] border-[#e5e7eb]">
            <div data-v-e38e2d82="" class="w-[50%] flex flex-col border-r-[1px] border-[#e5e7eb] justify-center items-center">
                <div data-v-e38e2d82="" class="text-[#333] font-semibold">Total Amount</div>
                <div data-v-e38e2d82="" class="text-xs text-[#999] mt-1">USDT <span data-v-e38e2d82="" class="text-sm text-[var(--main-color)] font-semibold">${totalPrice}</span></div>
            </div>
            <div data-v-e38e2d82="" class="w-[50%] flex flex-col justify-center items-center">
                <div data-v-e38e2d82="" class="text-[#333] font-semibold">Profit</div>
                <div data-v-e38e2d82="" class="text-xs text-[#999] mt-1">USDT <span data-v-e38e2d82="" class="text-sm text-[var(--main-color)] font-semibold">${totalCommission}</span></div>
            </div>
        </div>
        <div data-v-e38e2d82="" class="flex justify-between items-center pt-3 pb-2 box-border border-b-[1px] border-[#e5e7eb]">
            <div data-v-e38e2d82="" class="text-[#666] text-sm">Created At</div>
            <div data-v-e38e2d82="" class="text-[#333] text-sm font-bold">${grabbedDate}</div>
        </div>
        <div data-v-e38e2d82="" class="flex justify-between items-center pt-3 pb-2 box-border border-b-[1px] border-[#e5e7eb]">
            <div data-v-e38e2d82="" class="whitespace-nowrap text-[#666] text-sm">Task Code</div>
            <div data-v-e38e2d82="" class="text-[var(--main-color)] text-xs font-bold">${productNumber}</div>
        </div>
        <div data-v-e38e2d82="" class="w-full mt-4">
            <button data-v-e38e2d82="" type="button" class="van-button van-button--default van-button--large van-button--round" id="submitCombo" style="color: white; background: var(--btn-color); border-color: var(--btn-color);">
                <div class="van-button__content">
                    <span class="van-button__text"><span data-v-e38e2d82="" class="font-semibold text-white">Submit</span></span>
                </div>
            </button>
        </div>
    </div>
    </div>
    <div class="van-hairline--top van-dialog__footer">
    </div>
    `;

    $('#order2').html(comboBoxContent);
    // Note: The click handler for #submitCombo is now delegated in DOMContentLoaded
}


// --- Submit Order/Combo Logic (from embedded script, adapted) ---

function submitSingleOrder(token) {
    // Uses layer library for notifications
    var zhujiTime = 1000; // 1 second
    var shopTime = 1000; // 1 second

    var i = 0;
    if (typeof layer !== 'undefined') {
        layer.open({ type: 2, content: 'Order is being sent', time: zhujiTime, shadeClose: false });
    } else { console.log('Sending order...'); }

    var timer = setInterval(function() {
        i++;
        if (i == 1) {
            if (typeof layer !== 'undefined') {
                layer.open({ type: 2, content: 'The remote host is assigning', time: zhujiTime, shadeClose: false });
            } else { console.log('Assigning host...'); }
        } else if (i == 2) {
            clearInterval(timer); // Stop interval after second step
            var ajaxT = setTimeout(function() {
                // Extract data from the dialog popup
                var product_id = $('#product-id').text();
                // var product_price = $('#product-price').text(); // Not sent in original call
                var order_amount = $('#fund-amount').text(); // Use fund-amount as order_amount
                var earning_commission = $('#order-commission').text();
                var product_number = $('#product-number').text();

                // Basic validation
                if (!product_id || !order_amount || !earning_commission || !product_number) {
                    console.error("Missing data in order dialog for submission.");
                     if (typeof $(document).dialog === 'function') {
                        $(document).dialog({ infoText: "Error: Missing order data.", autoClose: 3000 });
                     } else { alert("Error: Missing order data."); }
                    return;
                }

                fetch(`${API_BASE_URL}/api/drive/saveorder`, { // Use local API endpoint
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        product_id: product_id,
                        order_amount: order_amount,
                        earning_commission: earning_commission,
                        product_number: product_number
                    })
                })
                .then(response => response.json())
                .then(res => {
                    if (typeof layer !== 'undefined') layer.closeAll(); // Close any layer popups

                    if (res.code == 0) { // Success code from backend
                         if (typeof $(document).dialog === 'function') {
                            $(document).dialog({ infoText: res.info || "Order Sent successfully!", autoClose: 2000 });
                         } else { alert(res.info || "Order Sent successfully!"); }

                        // Hide the dialog
                        $('#order1').hide();
                        $('#order2').hide().html(''); // Clear content

                        fetchBalance(token); // Refresh balance display

                        // Optionally fetch next order automatically or wait for user action
                        // fetchNextOrder(token);

                        // Original code reloaded the page, might not be ideal UX
                        // var linkTime = setTimeout(function() { location.reload() }, 1800);
                    } else {
                         if (typeof $(document).dialog === 'function') {
                            $(document).dialog({ infoText: res.info || "Failed to save order.", autoClose: 3000 });
                         } else { alert(res.info || "Failed to save order."); }
                    }
                })
                .catch(err => {
                    console.error('Error saving order:', err);
                    if (typeof layer !== 'undefined') layer.closeAll();
                     if (typeof $(document).dialog === 'function') {
                        $(document).dialog({ infoText: `Error saving order: ${err.message}`, autoClose: 3000 });
                     } else { alert(`Error saving order: ${err.message}`); }
                });

            }, shopTime);
        }
    }, zhujiTime);
}


function submitComboOrder(token) {
    // This function handles submitting a combo order.
    // It iterates through products stored in the dialog and calls saveComboProduct for each,
    // then calls saveComboOrder for the summary.
    var zhujiTime = 1000;
    var shopTime = 1000;

    var i = 0;
     if (typeof layer !== 'undefined') {
        layer.open({ type: 2, content: 'Combo order is being sent', time: zhujiTime, shadeClose: false });
    } else { console.log('Sending combo order...'); }


    var timer = setInterval(function() {
        i++;
        if (i == 1) {
             if (typeof layer !== 'undefined') {
                layer.open({ type: 2, content: 'The remote host is assigning combo', time: zhujiTime, shadeClose: false });
            } else { console.log('Assigning combo host...'); }
        } else if (i == 2) {
            clearInterval(timer); // Stop interval

            var total_combos = parseInt($('#total-combos').text() || '0');
            var order_amount = $('#order-amount').text();
            var order_commission = $('#order-commission').text();
            var product_number = $('#product-number').text(); // This is the overall combo task code

            if (total_combos === 0) {
                console.error("No combo products found in dialog.");
                 if (typeof $(document).dialog === 'function') {
                    $(document).dialog({ infoText: "Error: No combo products found.", autoClose: 3000 });
                 }
                return;
            }

            // Use Promises to handle sequential saving of combo products
            let savePromises = [];
            for (let idx = 0; idx < total_combos; idx++) {
                let combo_id = $(`#combo-id-${idx}`).text(); // Assuming combo_id is same for all products in combo? Or unique per item? Needs clarification.
                let product_id = $(`#product-id-${idx}`).text();
                let product_price = $(`#product-price-${idx}`).text();
                let product_commission = $(`#product-commission-${idx}`).text();

                if (!combo_id || !product_id || !product_price || !product_commission) {
                    console.error(`Missing data for combo product index ${idx}`);
                    continue; // Skip this product if data is missing
                }

                savePromises.push(
                    fetch(`${API_BASE_URL}/api/drive/savecomboproduct`, { // Use local API
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            combo_id: combo_id,
                            product_id: product_id,
                            product_price: product_price,
                            product_commission: product_commission
                        })
                    }).then(response => response.json())
                );
            }

            // Wait for all individual product saves to complete
            Promise.all(savePromises)
                .then(results => {
                    // Check if all individual saves were successful (code 0)
                    const allSucceeded = results.every(res => res.code === 0);

                    if (allSucceeded) {
                        // Now call the summary endpoint (if necessary)
                        return fetch(`${API_BASE_URL}/api/drive/savecomboorder`, { // Use local API
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                order_amount: order_amount,
                                order_commission: order_commission,
                                product_number: product_number,
                                total_combos: total_combos
                            })
                        }).then(response => response.json());
                    } else {
                        // Find the first error message
                        const firstError = results.find(res => res.code !== 0);
                        throw new Error(firstError?.info || 'Failed to save one or more combo products.');
                    }
                })
                .then(summaryResult => {
                     if (typeof layer !== 'undefined') layer.closeAll();

                    if (summaryResult.success) { // Check success from savecomboorder endpoint
                         if (typeof $(document).dialog === 'function') {
                            $(document).dialog({ infoText: "Combo Order Sent successfully!", autoClose: 2000 });
                         } else { alert("Combo Order Sent successfully!"); }

                        // Hide dialog, refresh balance
                        $('#order1').hide();
                        $('#order2').hide().html('');
                        fetchBalance(token);

                        // Optionally fetch next order
                        // fetchNextOrder(token);
                    } else {
                        throw new Error(summaryResult.message || 'Failed to save combo order summary.');
                    }
                })
                .catch(err => {
                    console.error('Error saving combo order:', err);
                    if (typeof layer !== 'undefined') layer.closeAll();
                     if (typeof $(document).dialog === 'function') {
                        $(document).dialog({ infoText: `Error saving combo: ${err.message}`, autoClose: 3000 });
                     } else { alert(`Error saving combo: ${err.message}`); }
                });

        }
    }, zhujiTime);
}
