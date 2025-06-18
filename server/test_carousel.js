// Test the public carousel endpoint
async function testCarousel() {
  try {
    console.log('🎠 Testing carousel endpoint...');
    
    const response = await fetch('http://localhost:3000/api/products/carousel');
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Carousel working!');
      console.log('📊 Products returned:', data.count);
      console.log('🎯 First product:', data.products[0]);
    } else {
      console.log('❌ Carousel failed:', response.status, await response.text());
    }
    
  } catch (error) {
    console.error('❌ Carousel test error:', error.message);
  }
}

testCarousel();
