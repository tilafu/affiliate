// Function to generate a unique referral code
function generateReferralCode(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // Removed lowercase for simplicity
  let referralCode = '';
  for (let i = 0; i < length; i++) {
    referralCode += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  // In a real application, you'd check for uniqueness against the database here
  return referralCode;
}

module.exports = {
  generateReferralCode,
};
