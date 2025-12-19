# 📧 MoonPay Account Activation Request Email

## 📮 Contactgegevens MoonPay Support

### ⚠️ Belangrijk: Direct Email Werkt Niet
MoonPay heeft aangegeven dat `support@moonpay.com` een "unmanaged email address" is. Ze gebruiken voornamelijk hun support portal.

### ✅ Aanbevolen Contactmethoden:

1. **Support Portal Chat (Primaire Methode)**
   - Ga naar: https://support.moonpay.com/
   - Gebruik de chat widget rechtsonder op de pagina
   - Dit is de officiële manier om support te krijgen

2. **Via MoonPay Dashboard**
   - Log in op: https://www.moonpay.com/dashboard
   - Check of er een "Contact Support" of "Help" knop is in het dashboard
   - Soms hebben dashboards een directe support functie

3. **Telefoon (Voor Business)**
   - **Telefoon:** +1 (833) 610-0735
   - **Let op:** Dit is voor zakelijke contacten, mogelijk niet voor algemene support

4. **Social Media (Alternatief)**
   - **Twitter/X:** @MoonPayHQ
   - **LinkedIn:** MoonPay
   - Soms reageren ze sneller via social media

5. **Business/Partnership Inquiries**
   - Check of er in je dashboard een "Partners" of "Business" sectie is
   - Soms hebben ze een aparte contactmethode voor business accounts

---

**Onderwerp:** Request to Enable On-Ramp Functionality for Live Account

---

**Email Body:**

Dear MoonPay Support Team,

I hope this email finds you well. I am reaching out to request activation of the On-Ramp functionality for my MoonPay account, as I am currently unable to use the live API endpoints.

**Account Information:**
- **Account Name:** Blaze Wallet
- **Public API Key:** `pk_live_TQQ0w0IEx4a6NtsrWlvoG0XfeAckBiNx`
- **Environment:** Production (Live)

**Issue Description:**
When attempting to fetch quotes using the MoonPay API v3 endpoint (`/v3/currencies/{currencyCode}/quote`), I receive the following error:

```
{
  "moonPayErrorCode": "1_SYS_UNKNOWN",
  "message": "On-Ramp is not yet enabled for live use. Please contact support for further instructions.",
  "type": "BadRequestError"
}
```

**What I Need:**
I would like to request activation of the On-Ramp functionality for my live account so that I can:
1. Fetch real-time quotes for cryptocurrency purchases
2. Process live transactions through the MoonPay widget
3. Use the production API endpoints for my wallet application

**Integration Details:**
- **Application:** Blaze Wallet (Non-custodial crypto wallet)
- **Integration Type:** Embedded MoonPay widget (React SDK)
- **Webhook URL:** `https://my.blazewallet.io/api/moonpay/webhook`
- **Use Case:** Fiat-to-crypto on-ramp for end users

**Current Status:**
- ✅ API keys are configured
- ✅ Webhook is set up and configured
- ✅ Integration code is complete and tested
- ❌ On-Ramp functionality needs to be enabled for live use

**Additional Information:**
- I have completed the necessary account setup and verification steps
- All required API keys and secrets are properly configured
- The integration follows MoonPay's official documentation

Could you please:
1. Enable On-Ramp functionality for my live account
2. Confirm when the activation is complete
3. Let me know if any additional steps or documentation are required

Thank you for your assistance. I look forward to your response.

Best regards,
[Your Name]
[Your Title]
Blaze Wallet
[Your Email]
[Your Phone Number (optional)]

---

**Alternative Shorter Version (if preferred):**

Subject: On-Ramp Activation Request - Account: Blaze Wallet

Dear MoonPay Support,

I'm requesting activation of On-Ramp functionality for my live account. Currently receiving error: "On-Ramp is not yet enabled for live use" when using API endpoint `/v3/currencies/{currencyCode}/quote`.

**Account Details:**
- API Key: `pk_live_TQQ0w0IEx4a6NtsrWlvoG0XfeAckBiNx`
- Application: Blaze Wallet
- Webhook: `https://my.blazewallet.io/api/moonpay/webhook`

Please enable On-Ramp for live use and confirm when ready.

Thank you,
[Your Name]
Blaze Wallet

