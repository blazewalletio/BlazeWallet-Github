/**
 * BLAZE Wallet - Telegram Bot Service
 * 
 * This service handles Telegram notifications for priority list registrations.
 * 
 * SETUP INSTRUCTIONS:
 * 
 * 1. Create a Telegram Bot:
 *    - Open Telegram and search for @BotFather
 *    - Send /newbot and follow the instructions
 *    - Copy the bot token (e.g., 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz)
 * 
 * 2. Get your Chat ID:
 *    - Search for @userinfobot on Telegram
 *    - Start a chat and it will send you your chat ID
 *    - Or create a channel/group and add the bot as admin
 * 
 * 3. Add to .env.local:
 *    TELEGRAM_BOT_TOKEN=your_bot_token_here
 *    TELEGRAM_ADMIN_CHAT_ID=your_chat_id_here
 *    TELEGRAM_PRIORITY_GROUP_ID=your_group_id_here (optional)
 * 
 * 4. Test the bot:
 *    - Send a test message using the sendNotification function
 *    - You should receive a message in your Telegram
 * 
 * FEATURES:
 * - New registration notifications
 * - Milestone alerts (100, 250, 500, 1000 registrations)
 * - Early bird countdown warnings
 * - Referral leaderboard updates
 * - Admin action logs
 */

import { logger } from '@/lib/logger';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const TELEGRAM_PRIORITY_GROUP_ID = process.env.TELEGRAM_PRIORITY_GROUP_ID;

const TELEGRAM_API_URL = TELEGRAM_BOT_TOKEN 
  ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
  : null;

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  disable_web_page_preview?: boolean;
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(message: TelegramMessage): Promise<boolean> {
  if (!TELEGRAM_API_URL) {
    logger.warn('Telegram bot not configured. Skipping notification.');
    return false;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (!result.ok) {
      logger.error('Telegram API error:', result);
      return false;
    }

    logger.log('Telegram message sent successfully');
    return true;
  } catch (error) {
    logger.error('Failed to send Telegram message:', error);
    return false;
  }
}

/**
 * Send admin notification
 */
export async function sendAdminNotification(text: string): Promise<boolean> {
  if (!TELEGRAM_ADMIN_CHAT_ID) {
    logger.warn('Admin chat ID not configured. Skipping notification.');
    return false;
  }

  return sendTelegramMessage({
    chat_id: TELEGRAM_ADMIN_CHAT_ID,
    text,
    parse_mode: 'HTML',
  });
}

/**
 * Send notification to priority list group
 */
export async function sendGroupNotification(text: string): Promise<boolean> {
  if (!TELEGRAM_PRIORITY_GROUP_ID) {
    logger.warn('Priority group ID not configured. Skipping notification.');
    return false;
  }

  return sendTelegramMessage({
    chat_id: TELEGRAM_PRIORITY_GROUP_ID,
    text,
    parse_mode: 'HTML',
  });
}

/**
 * Format new registration notification
 */
export async function notifyNewRegistration(data: {
  walletAddress: string;
  position: number;
  email?: string;
  referralCode: string;
  referredBy?: string;
  isEarlyBird: boolean;
}): Promise<void> {
  const earlyBirdEmoji = data.isEarlyBird ? '🎉 ' : '';
  const referralInfo = data.referredBy ? `\n👥 Referred by: <code>${data.referredBy.slice(0, 6)}...${data.referredBy.slice(-4)}</code>` : '';
  
  const message = `
🔥 <b>New Priority List Registration!</b> ${earlyBirdEmoji}

📍 Position: <b>#${data.position}</b>
👛 Wallet: <code>${data.walletAddress.slice(0, 6)}...${data.walletAddress.slice(-4)}</code>
📧 Email: ${data.email ? '✅' : '❌'}
🎫 Code: <code>${data.referralCode}</code>${referralInfo}

<a href="https://my.blazewallet.io/admin">View Dashboard</a>
  `.trim();

  await sendAdminNotification(message);
}

/**
 * Format milestone notification
 */
export async function notifyMilestone(
  totalRegistered: number,
  milestone: number
): Promise<void> {
  const message = `
🎯 <b>Milestone Achieved!</b>

We've reached <b>${totalRegistered}</b> priority list registrations!

${totalRegistered < 500 ? `🎉 Early Bird spots remaining: <b>${500 - totalRegistered}</b>` : '🔥 All Early Bird spots claimed!'}

Keep the momentum going! 🚀
  `.trim();

  await sendAdminNotification(message);
  await sendGroupNotification(message);
}

/**
 * Format early bird warning
 */
export async function notifyEarlyBirdWarning(spotsLeft: number): Promise<void> {
  const message = `
⚠️ <b>Early Bird Alert!</b>

Only <b>${spotsLeft}</b> Early Bird spots remaining!

First 500 registrants get exclusive bonuses 🎁

Register now: https://my.blazewallet.io
  `.trim();

  await sendGroupNotification(message);
}

/**
 * Format leaderboard update
 */
export async function notifyLeaderboardUpdate(leaderboard: Array<{
  wallet_address: string;
  referral_count: number;
}>): Promise<void> {
  const top5 = leaderboard.slice(0, 5);
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  
  const leaderboardText = top5.map((entry, idx) => 
    `${medals[idx]} <code>${entry.wallet_address.slice(0, 6)}...${entry.wallet_address.slice(-4)}</code> - <b>${entry.referral_count}</b> referrals`
  ).join('\n');

  const message = `
🏆 <b>Referral Leaderboard Update!</b>

Top 5 Referrers:

${leaderboardText}

Invite friends and climb the ranks! 🚀
  `.trim();

  await sendGroupNotification(message);
}

/**
 * Format presale start notification
 */
export async function notifyPresaleStart(priorityOnly: boolean): Promise<void> {
  const message = priorityOnly
    ? `
🚀 <b>BLAZE Presale is LIVE!</b>

Priority List members can now participate!

⏰ Exclusive 48-hour early access
💎 Get your BLAZE tokens before anyone else

<a href="https://my.blazewallet.io/presale">Join Presale Now</a>
    `.trim()
    : `
🔥 <b>BLAZE Presale Open to ALL!</b>

The presale is now open to everyone!

Don't miss your chance to get BLAZE tokens 💎

<a href="https://my.blazewallet.io/presale">Join Presale Now</a>
    `.trim();

  await sendAdminNotification(message);
  await sendGroupNotification(message);
}

/**
 * Test the Telegram bot configuration
 */
export async function testTelegramBot(): Promise<boolean> {
  const testMessage = `
🔥 <b>BLAZE Wallet - Telegram Bot Test</b>

Your Telegram notifications are working! ✅

Time: ${new Date().toLocaleString()}
  `.trim();

  return sendAdminNotification(testMessage);
}

// Export configuration status for debugging
export const telegramConfig = {
  isConfigured: !!TELEGRAM_BOT_TOKEN && !!TELEGRAM_ADMIN_CHAT_ID,
  hasBotToken: !!TELEGRAM_BOT_TOKEN,
  hasAdminChatId: !!TELEGRAM_ADMIN_CHAT_ID,
  hasGroupId: !!TELEGRAM_PRIORITY_GROUP_ID,
};

