export type PolicySection = {
  title: string;
  body?: string[];
  bullets?: string[];
};

export type PolicyDocument = {
  slug: string;
  title: string;
  effectiveDate: string;
  summary: string;
  contactEmail: string;
  sections: PolicySection[];
};

export const POLICY_DOCUMENTS: PolicyDocument[] = [
  {
    slug: "background-check-verification",
    title: "GotREFS Background Check & Verification Policy",
    effectiveDate: "Effective Date: To be updated",
    summary:
      "Standards and procedures for verifying the qualifications of officials who use the GotREFS platform.",
    contactEmail: "verification@GotREFS.org",
    sections: [
      {
        title: "Introduction",
        body: [
          'At GotREFS, the safety, integrity, and professionalism of youth and amateur sports are fundamental to our mission. This Background Check & Verification Policy ("Policy") establishes the standards and procedures for verifying the qualifications of officials who use the GotREFS platform.',
          'This Policy applies to all referees, umpires, officials, judges, scorekeepers, and other sports professionals ("Officials") who create an account on GotREFS.org.',
          "By using the platform, Officials acknowledge and agree to comply with this Policy.",
        ],
      },
      {
        title: "1. Purpose",
        body: [
          "Verification by GotREFS is intended to assist Event Organizers in evaluating Officials, but does not guarantee an Official's qualifications, performance, or suitability for any assignment.",
        ],
        bullets: [
          "Promote safe sporting environments.",
          "Increase confidence among Event Organizers.",
          "Verify officiating credentials.",
          "Help protect athletes, participants, and spectators.",
          "Maintain the integrity of the GotREFS community.",
        ],
      },
      {
        title: "2. Verification Requirements",
        body: [
          "Depending on the sport, governing body, event, or Organizer requirements, Officials may be asked to provide one or more credentials. Some assignments may require additional verification before an Official is eligible to accept the assignment.",
        ],
        bullets: [
          "Government-issued photo identification.",
          "Current officiating certifications or licenses.",
          "Governing body membership information.",
          "Proof of training or continuing education.",
          "NSID or equivalent background verification.",
          "SafeSport certification.",
          "First Aid and/or CPR certification, if required.",
          "Other credentials required by the Organizer or sanctioning organization.",
        ],
      },
      {
        title: "3. NSID Background Verification",
        body: [
          "Where required by an Organizer or governing body, Officials may be required to complete a background screening through National Sports ID (NSID) or another approved provider.",
          "Completion of a background check does not guarantee assignment eligibility, nor does it constitute an endorsement by GotREFS. Organizers may establish additional screening requirements beyond those required by GotREFS.",
        ],
        bullets: [
          "Criminal history review, where permitted by law.",
          "National sex offender registry search.",
          "Identity verification.",
          "Other legally permissible screening components.",
        ],
      },
      {
        title: "4. SafeSport Certification",
        body: ["Certain youth sports organizations require completion of SafeSport training."],
        bullets: [
          "Officials must provide proof of current SafeSport certification when required.",
          "Expired certifications may result in temporary removal from assignments requiring SafeSport compliance.",
          "Officials are responsible for maintaining current certification.",
        ],
      },
      {
        title: "5. Sport-Specific Certifications",
        body: [
          "Officials are responsible for maintaining all certifications required by the governing organizations for the sports they officiate. Officials must promptly update their GotREFS profile whenever certifications are renewed, suspended, or expire.",
        ],
        bullets: [
          "State high school athletic associations.",
          "National governing bodies.",
          "USA sport organizations.",
          "Collegiate conferences.",
          "Independent officiating associations.",
        ],
      },
      {
        title: "6. Annual Renewal Requirements",
        body: [
          "To maintain Verified status, Officials may be required to renew certain credentials annually. Officials are solely responsible for ensuring their credentials remain current.",
        ],
        bullets: [
          "Background verification.",
          "SafeSport certification.",
          "Governing body registration.",
          "Rule examinations.",
          "Continuing education.",
          "Other Organizer-specific requirements.",
        ],
      },
      {
        title: "7. Verification Badges",
        body: [
          "GotREFS may display verification badges on Official profiles to assist Organizers in evaluating qualifications. Verification badges indicate only that the stated credential has been verified by GotREFS or an approved provider. They do not represent a guarantee of performance, competence, or suitability.",
        ],
        bullets: [
          "Identity Verified.",
          "Background Verified.",
          "SafeSport Certified.",
          "Certification Verified.",
          "Veteran Official.",
          "Highly Rated.",
          "Rule Exam Completed, where applicable.",
        ],
      },
      {
        title: "8. Credential Accuracy",
        body: [
          "Officials certify that all information submitted to GotREFS is truthful, complete, and accurate. Providing false information may result in immediate suspension or permanent removal from the platform.",
        ],
        bullets: [
          "Do not submit altered or fraudulent documents.",
          "Do not misrepresent certifications.",
          "Do not use another person's credentials.",
          "Do not claim qualifications you do not possess.",
        ],
      },
      {
        title: "9. Organizer Requirements",
        body: [
          "Event Organizers may establish additional eligibility requirements beyond those required by GotREFS. Officials are responsible for reviewing assignment requirements before accepting an assignment.",
        ],
        bullets: [
          "Minimum years of experience.",
          "Specific governing body membership.",
          "Tournament certifications.",
          "State licensing.",
          "Sport-specific testing.",
          "Insurance requirements.",
        ],
      },
      {
        title: "10. Suspension of Verification Status",
        body: [
          "GotREFS may suspend an Official's verification status if required credentials expire, required documentation cannot be verified, fraudulent documentation is suspected, the Official becomes ineligible under applicable governing body rules, or credible evidence of serious misconduct is received.",
          "Suspension of verification status may also result in temporary removal from assignments requiring verified credentials.",
        ],
      },
      {
        title: "11. Permanent Removal",
        body: [
          "GotREFS reserves the right to determine, in its sole discretion, whether removal is appropriate based on the facts and applicable law.",
        ],
        bullets: [
          "Falsifying credentials.",
          "Fraud.",
          "Criminal conduct affecting eligibility.",
          "Permanent suspension by a governing body for misconduct.",
          "Sexual misconduct.",
          "Violence or threats of violence.",
          "Repeated violations of GotREFS Terms & Conditions or Community Standards.",
        ],
      },
      {
        title: "12. Appeals Process",
        body: [
          "Officials who believe a verification decision or suspension was made in error may submit a written appeal within 14 days of notification. GotREFS will review the information submitted and notify the Official of its decision. Decisions made following the appeal process are final.",
        ],
        bullets: [
          "The reason for the appeal.",
          "Updated or corrected documentation.",
          "Supporting evidence, if applicable.",
        ],
      },
      {
        title: "13. Privacy of Verification Information",
        body: [
          "Verification records and supporting documents are handled in accordance with the GotREFS Privacy Policy. GotREFS does not publicly display confidential background screening reports.",
        ],
        bullets: [
          "Sensitive information may be shared with authorized service providers performing verification services.",
          "Sensitive information may be shared when required by law.",
          "Sensitive information may be shared with Event Organizers only to the extent necessary to confirm verification status or satisfy event requirements.",
        ],
      },
      {
        title: "14. No Employment Relationship",
        body: [
          "Verification by GotREFS does not create an employment relationship between GotREFS and any Official. Officials remain independent contractors responsible for maintaining their own qualifications and complying with applicable laws and governing body requirements.",
        ],
      },
      {
        title: "15. Limitation of Responsibility",
        body: [
          "While GotREFS strives to verify credentials accurately, verification is based on information provided by Officials, Organizers, governing bodies, and third-party verification providers. Organizers remain responsible for determining whether an Official meets the specific requirements of their event.",
        ],
        bullets: [
          "GotREFS does not guarantee the accuracy of third-party records.",
          "GotREFS does not guarantee future eligibility of an Official.",
          "GotREFS does not guarantee the quality of officiating performance.",
          "GotREFS does not guarantee assignment suitability.",
          "GotREFS does not guarantee continued certification after verification.",
        ],
      },
      {
        title: "16. Policy Changes",
        body: [
          "GotREFS reserves the right to modify this Policy at any time. Updated versions will be posted on GotREFS.org, and continued use of the platform constitutes acceptance of any revisions.",
        ],
      },
      {
        title: "Contact Information",
        body: [
          "Questions regarding this Policy or verification requirements may be directed to GotREFS at verification@GotREFS.org.",
        ],
      },
      {
        title: "Acknowledgement",
        body: [
          "By creating an account, submitting credentials, accepting assignments, or participating on the GotREFS platform, you acknowledge that you have read, understood, and agree to comply with this Background Check & Verification Policy.",
        ],
      },
    ],
  },
  {
    slug: "community-standards",
    title: "GotREFS Community Standards & Code of Conduct",
    effectiveDate: "Effective Date: To be updated",
    summary:
      "Expectations for professional, respectful conduct across the GotREFS community and events coordinated through the platform.",
    contactEmail: "conduct@GotREFS.org",
    sections: [
      {
        title: "Introduction",
        body: [
          'At GotREFS, our mission is to create a trusted, professional, and respectful environment for everyone involved in amateur and youth sports. These Community Standards & Code of Conduct ("Code") establish the expectations for all users of the GotREFS platform, including Event Organizers, Officials, Coaches, Players, Parents, Spectators, Volunteers, and Staff.',
          "By using GotREFS.org, participating in events coordinated through the platform, or interacting with members of the GotREFS community, you agree to abide by these standards.",
        ],
      },
      {
        title: "Our Core Values",
        body: ["Every member of the GotREFS community is expected to uphold these principles."],
        bullets: [
          "Integrity - Be honest, fair, and ethical in every interaction.",
          "Respect - Treat everyone with dignity and professionalism.",
          "Sportsmanship - Promote fair play and positive competition.",
          "Safety - Help create a safe environment for participants and officials.",
          "Accountability - Take responsibility for your actions.",
          "Inclusion - Welcome participants of all backgrounds and abilities.",
        ],
      },
      {
        title: "1. Standards for Event Organizers",
        body: ["Organizers agree to act professionally and support safe, organized events."],
        bullets: [
          "Treat Officials with professionalism and respect.",
          "Provide accurate schedules, locations, and assignment details.",
          "Ensure Officials have access to the playing area before contests.",
          "Provide a safe environment for all participants.",
          "Address misconduct by coaches, parents, players, and spectators.",
          "Pay Officials according to agreed-upon terms.",
          "Communicate schedule changes promptly.",
          "Support Officials in enforcing the rules of the game.",
          "Do not threaten or intimidate Officials, encourage abuse, knowingly assign unqualified Officials, discriminate, or misrepresent event details.",
        ],
      },
      {
        title: "2. Standards for Officials",
        body: ["Officials represent the integrity of sport and are expected to act professionally."],
        bullets: [
          "Arrive on time and prepared.",
          "Wear the appropriate uniform and equipment.",
          "Officiate fairly, impartially, and professionally.",
          "Apply the rules consistently.",
          "Treat participants with respect.",
          "Maintain composure during difficult situations.",
          "Avoid conflicts of interest.",
          "Report unsafe conditions or serious misconduct.",
          "Do not use abusive language, harass or discriminate, consume alcohol or illegal drugs before or during assignments, accept bribes, or engage in unsportsmanlike behavior.",
        ],
      },
      {
        title: "3. Standards for Coaches",
        bullets: [
          "Demonstrate sportsmanship.",
          "Respect Officials and their decisions.",
          "Model appropriate behavior for athletes.",
          "Address concerns professionally.",
          "Encourage fair play.",
          "Help maintain a positive game environment.",
          "Do not harass Officials, use threatening language, encourage unsportsmanlike conduct, incite spectators, or intentionally undermine game officials.",
        ],
      },
      {
        title: "4. Standards for Players",
        bullets: [
          "Respect Officials.",
          "Respect opponents.",
          "Follow the rules of the game.",
          "Display good sportsmanship.",
          "Accept game decisions appropriately.",
          "Compete honestly.",
          "Do not threaten Officials, use discriminatory language, fight, intimidate Officials, or damage property.",
        ],
      },
      {
        title: "5. Standards for Parents & Spectators",
        body: [
          "Parents and spectators play an important role in youth sports. Individuals who violate these standards may be removed from the venue without refund, where applicable.",
        ],
        bullets: [
          "Cheer positively.",
          "Respect Officials and opposing teams.",
          "Encourage sportsmanship.",
          "Follow facility rules.",
          "Support a positive experience for all participants.",
          "Do not verbally abuse Officials, use profanity directed toward participants, threaten anyone, enter the playing surface without authorization, interfere with game administration, or harass players, coaches, or other spectators.",
        ],
      },
      {
        title: "6. Harassment & Discrimination",
        body: [
          "GotREFS maintains zero tolerance for harassment, bullying, threats, intimidation, sexual harassment, hate speech, and discrimination based on protected characteristics under applicable law.",
          "Violations may result in immediate removal from the platform and referral to appropriate authorities when warranted.",
        ],
      },
      {
        title: "7. Violence & Safety",
        body: [
          "Violence or threats of violence are strictly prohibited. Individuals should immediately report safety concerns to event staff and, where appropriate, local law enforcement.",
        ],
        bullets: [
          "Physical assault.",
          "Threatening behavior.",
          "Throwing objects.",
          "Property damage.",
          "Fighting.",
          "Stalking.",
          "Intimidation.",
        ],
      },
      {
        title: "8. Online Conduct",
        body: ["Community standards apply both in person and online. Constructive feedback is encouraged; abusive online behavior is not."],
        bullets: [
          "Do not post defamatory statements.",
          "Do not share false information.",
          "Do not impersonate others.",
          "Do not publish confidential information without authorization.",
          "Do not harass community members through email, text messages, or social media.",
        ],
      },
      {
        title: "9. Reporting Misconduct",
        body: [
          "Anyone may report conduct that violates this Code. Reports may be submitted through the GotREFS platform or by contacting support. GotREFS will review reports as promptly as reasonably possible.",
        ],
        bullets: [
          "Date and time of the incident.",
          "Event name.",
          "Individuals involved.",
          "Description of the incident.",
          "Supporting photographs, videos, or documentation.",
        ],
      },
      {
        title: "10. Investigation Process",
        body: ["When a complaint is received, GotREFS may take investigative steps and temporary action while an investigation is pending, when appropriate. Participation in an investigation is expected from all users."],
        bullets: [
          "Review available evidence.",
          "Contact the parties involved.",
          "Request witness statements.",
          "Review assignment history.",
          "Consult with event organizers or governing bodies.",
        ],
      },
      {
        title: "11. Enforcement",
        body: [
          "GotREFS reserves the right to determine the appropriate response based on the facts and circumstances of each case.",
        ],
        bullets: [
          "Educational warning.",
          "Written warning.",
          "Temporary account suspension.",
          "Removal from specific assignments.",
          "Permanent account termination.",
          "Restriction of platform privileges.",
          "Referral to governing bodies, leagues, or law enforcement when appropriate.",
        ],
      },
      {
        title: "12. Appeals",
        body: [
          "Users who believe enforcement action was taken in error may submit a written appeal within 14 days of receiving notice. GotREFS will review the appeal and issue a final decision.",
        ],
        bullets: [
          "The reason for the appeal.",
          "Any supporting documentation.",
          "Relevant witness statements, if available.",
        ],
      },
      {
        title: "13. No Retaliation",
        body: [
          "Retaliation against anyone who reports misconduct or participates in an investigation is strictly prohibited. Retaliation itself may result in disciplinary action, including removal from the platform.",
        ],
      },
      {
        title: "14. Commitment to Youth Sports",
        body: [
          "GotREFS believes youth and amateur sports should provide a safe, positive, and enjoyable experience for everyone. Every member of the community shares responsibility for creating an environment built on respect, fairness, professionalism, integrity, inclusion, and sportsmanship.",
        ],
      },
      {
        title: "15. Changes to this Code",
        body: [
          "GotREFS may update these Community Standards & Code of Conduct from time to time. Updated versions will be posted on GotREFS.org, and continued use of the platform constitutes acceptance of any revisions.",
        ],
      },
      {
        title: "Contact Us",
        body: [
          "Questions or reports regarding this Code may be submitted to GotREFS at conduct@GotREFS.org.",
        ],
      },
      {
        title: "Acknowledgement",
        body: [
          "By creating an account, using the GotREFS platform, attending an event, accepting assignments, organizing events, coaching, participating, or spectating at an event coordinated through GotREFS, you acknowledge that you have read, understood, and agree to comply with these Community Standards & Code of Conduct.",
        ],
      },
    ],
  },
  {
    slug: "payment-fee-policy",
    title: "GotREFS Payment & Fee Policy",
    effectiveDate: "Effective Date: To be updated",
    summary: "Rules for platform fees, payment processing, refunds, chargebacks, taxes, invoices, and payment disputes.",
    contactEmail: "billing@GotREFS.org",
    sections: [
      {
        title: "Introduction",
        body: [
          'This Payment & Fee Policy ("Policy") governs all payments processed through GotREFS.org. By using the GotREFS platform, Event Organizers and Referees/Officials agree to comply with this Policy.',
        ],
      },
      {
        title: "1. Purpose",
        body: [
          "GotREFS is a technology platform that connects Event Organizers with qualified sports officials. Depending on the services selected, GotREFS may facilitate payments between Organizers and Officials or provide scheduling services only.",
        ],
      },
      {
        title: "2. Payment Responsibility",
        bullets: [
          "Organizers are responsible for paying agreed officiating fees, GotREFS platform or service fees, maintaining a valid payment method when required, and paying invoices by the stated due date.",
          "Officials are responsible for providing accurate payment information, maintaining tax information when required, reviewing assignment compensation, and reporting discrepancies promptly.",
          "Failure to make timely payments may result in suspension or termination of an Organizer account.",
        ],
      },
      {
        title: "3. Platform Fees",
        body: ["GotREFS may charge platform access fees, scheduling service fees, assignment fees, verification fees, background check fees, subscription or membership fees, premium feature fees, and payment processing fees."],
      },
      {
        title: "4. Payment Processing",
        body: ["Payments made through GotREFS are processed by secure third-party payment providers. GotREFS does not store full payment card information."],
        bullets: ["Credit cards.", "Debit cards.", "ACH bank transfers.", "Digital wallets.", "Other approved electronic payment methods."],
      },
      {
        title: "5. Official Payments",
        body: [
          "Officials will be paid according to the payment terms established by the Organizer or through the GotREFS payment system. Payment timing may vary by payment method. GotREFS is not responsible for delays caused by banks, payment processors, incorrect information, or government processing delays.",
        ],
      },
      {
        title: "6. Invoices, Late Payments, and Disputes",
        bullets: [
          "Invoices are due according to the terms listed on the invoice.",
          "Late or unpaid invoices may result in late fees, interest where permitted, suspension, collection activity, or legal action.",
          "Payment disputes must be reported within 30 days of the transaction or scheduled payment date with assignment details, service date, amount, and supporting documentation.",
        ],
      },
      {
        title: "7. Refunds and Chargebacks",
        body: [
          "Unless otherwise stated, fees paid to GotREFS for platform services, subscriptions, verification, or processing are non-refundable. Refund requests may be evaluated case by case for duplicate payments, billing errors, unauthorized transactions verified by investigation, or platform-caused technical errors.",
          "Chargebacks or payment reversals may result in account suspension during investigation. Users remain responsible for legitimate charges, and fraudulent or abusive chargebacks may result in removal from the platform and legal action.",
        ],
      },
      {
        title: "8. Taxes and Payment Errors",
        body: [
          "Officials are independent contractors solely responsible for reporting income, paying taxes, self-employment taxes where applicable, and maintaining required business licenses. GotREFS may request tax documentation, including IRS Form W-9, when required.",
          "If an overpayment or underpayment occurs, users agree to promptly notify GotREFS. GotREFS may correct payment errors, including recovering funds paid in error or issuing additional payments when appropriate.",
        ],
      },
      {
        title: "9. Fraud Prevention and Account Suspension",
        body: [
          "GotREFS may verify payment information, delay processing while investigating suspicious activity, request identity verification, and decline or cancel transactions believed to be fraudulent or unauthorized.",
          "GotREFS may suspend or terminate accounts for non-payment, excessive disputes, fraudulent transactions, repeated chargebacks, or violation of this Policy. Termination does not relieve outstanding financial obligations.",
        ],
      },
      {
        title: "10. Limitation of Liability and Changes",
        body: [
          "GotREFS is not responsible for bank processing delays, processor outages, currency conversion fees, returned payments due to incorrect account information, lost profits from delayed payments, or financial losses from disputes between Organizers and Officials except where GotREFS is directly responsible for processing payment.",
          "GotREFS may modify this Policy at any time. Material updates will be posted on the platform with an updated Effective Date.",
        ],
      },
    ],
  },
  {
    slug: "privacy-policy",
    title: "GotREFS Privacy Policy",
    effectiveDate: "Effective Date: To be updated",
    summary: "How GotREFS collects, uses, stores, shares, and protects user information across the platform.",
    contactEmail: "privacy@GotREFS.org",
    sections: [
      {
        title: "Introduction",
        body: [
          'Your privacy is important to us. This Privacy Policy explains how GotREFS collects, uses, stores, shares, and protects your information when you use our website, mobile applications, and related services (the "Platform").',
          "By accessing or using the platform, you acknowledge that you have read and understand this Privacy Policy.",
        ],
      },
      {
        title: "1. Information We Collect",
        bullets: [
          "Personal information such as name, email, phone, mailing address, date of birth when required, profile photograph, emergency contact information, government ID when required, certifications, organization affiliations, payment information processed by third parties, and tax information when required.",
          "Professional information such as sports officiated, years of experience, certification levels, availability, service areas, verification status, ratings, reviews, assignment history, organization name, event information, billing information, scheduling contacts, and payment history.",
          "Automatically collected information such as IP address, browser type, device information, operating system, pages visited, access time, login history, referring website, device identifiers, and approximate location derived from IP address.",
          "Cookies and similar technologies used to keep users signed in, remember preferences, improve performance, analyze usage, detect fraud, and enhance security.",
        ],
      },
      {
        title: "2. How We Use Your Information",
        bullets: [
          "Create and manage user accounts.",
          "Match officials with organizers and schedule assignments.",
          "Process payments and verify credentials.",
          "Provide customer support and improve the platform.",
          "Prevent fraud, abuse, and security issues.",
          "Communicate important updates and optional marketing communications.",
          "Comply with legal obligations.",
        ],
      },
      {
        title: "3. How We Share Information",
        body: ["GotREFS does not sell personal information."],
        bullets: [
          "Event Organizers may receive information necessary for assignments, including name, contact information, certifications, ratings, availability, and verification status.",
          "Officials may receive Organizer information needed for assignments, including event details, contact information, location, compensation, and scheduling information.",
          "Trusted service providers may process payment, background verification, hosting, email, SMS, support, analytics, and security services under contractual privacy obligations.",
          "Information may be disclosed to comply with law, respond to legal process, protect user safety, investigate fraud or illegal activity, or protect GotREFS rights.",
        ],
      },
      {
        title: "4. Data Security and Retention",
        body: [
          "GotREFS uses commercially reasonable administrative, technical, and physical safeguards such as SSL/TLS, password encryption, role-based access controls, secure cloud infrastructure, firewall protection, monitoring, and regular updates. No electronic transmission or storage method is completely secure.",
          "We retain personal information only as long as reasonably necessary to provide services, maintain records, resolve disputes, comply with legal obligations, and enforce agreements.",
        ],
      },
      {
        title: "5. Privacy Rights",
        body: [
          "Subject to applicable law, users may request access, correction, profile updates, account deletion, deletion of personal information subject to legal exceptions, copies of information where applicable, marketing opt-out, and notification preference management.",
          "California residents may have additional rights under CCPA/CPRA, including requests to know, delete, correct, limit certain sensitive information where applicable, and exercise rights without discrimination. GotREFS does not sell or share personal information for cross-context behavioral advertising as defined by California law.",
        ],
      },
      {
        title: "6. Children, Third-Party Links, Account Security, and International Users",
        body: [
          "GotREFS is not intended for children under 13 and does not knowingly collect information from children under 13 without appropriate consent where required.",
          "The platform may link to third-party services. GotREFS is not responsible for their privacy practices.",
          "Users are responsible for protecting login credentials and notifying GotREFS of suspected unauthorized access.",
          "GotREFS is operated from the United States, and international users understand their information may be transferred to and processed in the United States.",
        ],
      },
      {
        title: "7. Policy Changes and Contact",
        body: [
          "GotREFS may update this Privacy Policy periodically. Material changes will be posted on the platform with an updated Effective Date.",
          "Questions or privacy rights requests may be sent to privacy@GotREFS.org.",
        ],
      },
    ],
  },
  {
    slug: "event-organizer-terms",
    title: "GotREFS Event Organizer Terms & Conditions",
    effectiveDate: "Effective Date: To be updated",
    summary: "Terms governing organizer accounts, event postings, payments, conduct, cancellations, and platform use.",
    contactEmail: "support@GotREFS.org",
    sections: [
      { title: "Introduction", body: ['These Terms & Conditions govern the use of GotREFS.org by any organization, league, tournament, school, club, or individual utilizing the platform to locate, assign, and manage sports officials. By creating an account, posting assignments, or otherwise using GotREFS.org, the Organizer agrees to these Terms.'] },
      { title: "1. Organizer Responsibilities", bullets: ["Provide complete and accurate event information.", "Post assignments with correct dates, times, locations, age groups, sport, pay rates, and game formats.", "Maintain a safe, respectful, and professional environment.", "Communicate schedule changes immediately.", "Designate an on-site contact.", "Comply with applicable laws."] },
      { title: "2. Independent Contractor Relationship", body: ["Officials using GotREFS are independent contractors. Nothing in these Terms creates an employer-employee relationship between GotREFS and any official. Organizers are responsible for selecting assignments, supervising events, paying officials unless payment is processed through GotREFS, and complying with tax and labor laws."] },
      { title: "3. Payments and Cancellations", body: ["Organizer agrees to pay all officials the compensation listed when accepting assignments and is responsible for applicable platform fees and service charges. Failure to pay may result in suspension, late charges, collection costs, or other remedies.", "Organizers must notify officials immediately of cancellations. Unless otherwise agreed, games canceled within 72 hours may require payment up to 50% of the assigned fee, and games canceled within 24 hours may require payment of 100% if replacement work cannot reasonably be obtained. Weather cancellations are subject to posted Organizer policies."] },
      { title: "4. Professional Conduct and Verification", body: ["Organizers must provide an environment free from harassment, threats, discrimination, intimidation, physical abuse, and verbal abuse, and are responsible for the behavior of coaches, players, parents, spectators, volunteers, and staff.", "GotREFS may display verification, certifications, experience, ratings, and sport-specific qualifications. The Organizer remains responsible for determining whether an official meets event requirements."] },
      { title: "5. Ratings, No Circumvention, and Insurance", body: ["Organizers may provide honest, factual reviews. Reviews containing false information, personal attacks, defamation, profanity, or discriminatory remarks may be removed.", "Organizers agree not to intentionally circumvent GotREFS by directly hiring or soliciting officials first introduced through the platform to avoid GotREFS fees for 24 months following first assignment through GotREFS.", "Organizers are responsible for maintaining all event insurance. GotREFS does not provide event insurance, general liability insurance, or participant accident insurance."] },
      { title: "6. Liability, Indemnification, and Termination", body: ["GotREFS is a technology platform and does not supervise games or direct officials. To the fullest extent permitted by law, GotREFS is not liable for game outcomes, judgment calls, injuries, property damage, cancellations, scheduling conflicts, acts or omissions, lost profits, or consequential damages.", "Organizers agree to defend, indemnify, and hold harmless GotREFS from claims arising from Organizer events, negligence, breach, injuries, or legal violations.", "GotREFS may suspend or terminate Organizer accounts for non-payment, fraud, chargebacks, misrepresentation, harassment, repeated cancellations, circumvention, or violations."] },
      { title: "7. Disputes, Privacy, Platform, IP, and Law", body: ["Disputes first proceed through good-faith negotiation, then confidential mediation, then binding arbitration in Orange County, California unless prohibited by law. California law governs these Terms.", "Organizer information is used under the GotREFS Privacy Policy. The platform is provided AS IS and AS AVAILABLE. GotREFS intellectual property remains GotREFS property. GotREFS may modify these Terms, and continued use constitutes acceptance."] },
    ],
  },
  {
    slug: "referee-official-terms",
    title: "GotREFS Referee & Official Terms & Conditions",
    effectiveDate: "Effective Date: To be updated",
    summary: "Terms governing official eligibility, assignments, conduct, compensation, cancellations, safety, and platform use.",
    contactEmail: "support@GotREFS.org",
    sections: [
      { title: "Introduction", body: ['These Terms & Conditions govern use of GotREFS.org by referees, umpires, officials, judges, scorekeepers, and other sports officials who use the platform to locate, accept, and manage officiating assignments. By creating an account or using GotREFS.org, Officials agree to these Terms.'] },
      { title: "1. Eligibility and Independent Contractor Status", body: ["Officials represent that they are at least 18 or have parental/legal guardian consent where permitted, are legally authorized to work, will provide accurate information, and will maintain required licenses, certifications, and registrations.", "Officials are independent contractors, not employees, partners, joint venturers, or agents of GotREFS. Officials are responsible for assignments, taxes, licenses, uniforms, equipment, and transportation."] },
      { title: "2. Profile Accuracy and Background Verification", body: ["Officials must maintain accurate name, contact, sports, certifications, experience, availability, and background verification status. False or misleading information may result in suspension or termination.", "Certain assignments may require criminal background screening, SafeSport certification, governing body certifications, or other verification. Completion of a background check is not a guarantee or endorsement by GotREFS."] },
      { title: "3. Assignment Acceptance, Conduct, and Compensation", body: ["Officials may accept or decline assignments. Once accepted, Officials agree to arrive on time, be properly equipped and professionally dressed, officiate under applicable rules, and notify the Organizer immediately if an emergency prevents attendance.", "Officials must act professionally, treat participants with respect, avoid abuse or discrimination, avoid drugs or alcohol before or during assignments, and avoid conflicts of interest. Compensation is determined by the Organizer, and GotREFS does not guarantee minimum earnings unless otherwise specified."] },
      { title: "4. Cancellations, Ratings, Platform Use, and No Circumvention", body: ["Officials should provide cancellation notice as soon as possible. Repeated late cancellations or no-shows may affect ratings or result in suspension.", "Organizers may rate Officials, and Officials may rate Organizers. Reviews that are false, fraudulent, defamatory, offensive, or discriminatory may be removed.", "Officials may not create multiple accounts, share credentials, misrepresent certifications, manipulate reviews, interfere with the platform, or intentionally bypass GotREFS to avoid applicable service fees for 24 months after an introduction through GotREFS."] },
      { title: "5. Safety and Insurance", body: ["Officials should report unsafe playing conditions, threats, harassment, assault, and serious misconduct, and should leave an event if personal safety is reasonably at risk.", "Officials are responsible for any personal insurance they deem appropriate. GotREFS does not provide health insurance, workers' compensation, disability insurance, liability insurance, or vehicle insurance."] },
      { title: "6. Liability, Indemnification, and Termination", body: ["GotREFS is a technology platform and is not liable for payment disputes, cancellations, injuries, property damage, lost wages, transportation issues, scheduling conflicts, or actions of Organizers, coaches, players, or spectators to the fullest extent permitted by law.", "Officials agree to defend, indemnify, and hold harmless GotREFS from claims arising from negligence, misconduct, violations of these Terms, or legal violations.", "GotREFS may suspend or terminate accounts for fraud, falsified credentials, unsafe conduct, repeated no-shows, abuse, circumvention, or violation of these Terms."] },
      { title: "7. Intellectual Property, Privacy, Platform, Disputes, and Law", body: ["GotREFS software, trademarks, logos, databases, ratings, verification systems, and content remain GotREFS property. Official information is handled under the Privacy Policy. The platform is provided AS IS and AS AVAILABLE.", "Disputes first proceed through good-faith negotiation, then confidential mediation, then binding arbitration in Orange County, California unless prohibited by law. California law governs these Terms. GotREFS may modify these Terms, and continued use constitutes acceptance."] },
    ],
  },
  {
    slug: "verified-program",
    title: "GotREFS Verified Program",
    effectiveDate: "Program information",
    summary: "The GotREFS trust and credential verification program for officials across youth and amateur sports.",
    contactEmail: "verification@GotREFS.org",
    sections: [
      { title: "Program Overview", body: ["The GotREFS Verified Program is the official trust and credential verification program of GotREFS.org. It helps Event Organizers identify Officials who have completed identity verification and maintain credentials required to officiate youth and amateur sporting events. Being GotREFS Verified is a recognition of professionalism, not a guarantee of performance."] },
      { title: "Mission", bullets: ["Increase trust between Organizers and Officials.", "Promote safer youth sports.", "Simplify the hiring process.", "Encourage professional development.", "Recognize Officials who maintain current credentials.", "Establish GotREFS as a premier officiating marketplace in North America."] },
      { title: "Verification Levels", bullets: ["GotREFS Verified: identity, active account, email and mobile verification, profile photo, accepted terms, and Community Standards acknowledgement.", "GotREFS Certified: Verified plus governing body certifications, active credentials, rule certification where applicable, and expiration dates on file.", "GotREFS SafeSport Verified: current SafeSport certification and completion date verification.", "GotREFS Background Verified: current NSID or approved national screening and identity verification.", "GotREFS Elite: highest recognition for experienced, highly rated, reliable, professional Officials with no serious disciplinary actions."] },
      { title: "Verification Categories", bullets: ["Identity Verified.", "Background Verified.", "SafeSport Verified.", "Certification Verified.", "Veteran Official.", "Elite Official.", "Tournament Certified.", "State Certified.", "NCAA Certified where applicable.", "NFHS Certified.", "USA Sport Certified."] },
      { title: "Benefits", bullets: ["Officials may receive higher visibility, increased credibility, priority consideration where applicable, profile badges, renewal reminders, digital certificates, and future professional development opportunities.", "Organizers can quickly identify Officials with verified identity, current certifications, background verification, SafeSport compliance, reliable assignment history, and strong community ratings."] },
      { title: "Maintaining Verification", body: ["Officials are responsible for maintaining current credentials. Verification may require periodic renewal of background checks, SafeSport certification, governing body memberships, rule examinations, professional certifications, and contact information. Expired credentials may temporarily remove badges or limit assignment eligibility until documentation is updated and approved."] },
      { title: "Suspension or Removal", body: ["Verification may be suspended if credentials expire, documents cannot be verified, fraudulent documents are submitted, SafeSport or background screening lapses, or serious misconduct is reported and under investigation. Verification may be permanently revoked for falsified credentials, identity fraud, criminal conduct affecting eligibility, permanent suspension by a governing body, sexual misconduct, violence, or repeated policy violations."] },
      { title: "Digital Certificate and Public Profile", body: ["Verified Officials may receive a digital certificate showing name, verification level, verification ID, date, expiration date if applicable, and QR code linking to a public GotREFS profile. Public profiles may show photo, sports, experience, certifications, badges, service area, ratings, reviews, completed assignments where optional, and expiration dates where appropriate. Sensitive information such as background reports and ID documents will never be displayed publicly."] },
      { title: "Disclaimer", body: ["The GotREFS Verified Program assists Event Organizers in evaluating Officials. Verification confirms that specific credentials or requirements were reviewed by GotREFS or an approved provider at the time of verification. It does not guarantee future performance, assignment eligibility, employment, or officiating ability beyond verified credentials, and does not replace Organizer due diligence."] },
    ],
  },
];

export function getPolicyBySlug(slug: string) {
  return POLICY_DOCUMENTS.find((policy) => policy.slug === slug) ?? null;
}
