export type FaqItem = {
  q: string;
  a?: string;
  bullets?: string[];
};

export type FaqSection = {
  title: string;
  items: FaqItem[];
};

export const FAQ_PAGE_TITLE = "GotREFS Frequently Asked Questions";

export const FAQ_SECTIONS: FaqSection[] = [
  {
    title: "General Questions",
    items: [
      {
        q: "What is GotREFS?",
        a: "GotREFS is a nationwide referee marketplace that connects certified, verified officials with sports organizers, leagues, tournaments, schools, and athletic directors. Organizers can quickly find qualified officials, while referees can discover games, manage availability, and receive assignments from one platform.",
      },
      {
        q: "Who uses GotREFS?",
        bullets: [
          "Referees and umpires",
          "Assignors",
          "Tournament directors",
          "League administrators",
          "Athletic directors",
          "Sports organizations",
          "Schools and parks & recreation departments",
        ],
      },
      {
        q: "What sports does GotREFS support?",
        a: "GotREFS supports virtually every officiated sport, including football, basketball, baseball, softball, soccer, volleyball, lacrosse, wrestling, hockey, rugby, and more. The platform is designed to serve over 30 sports nationwide.",
      },
      {
        q: "Is GotREFS available nationwide?",
        a: "Yes. GotREFS supports organizers and officials in all 50 states.",
      },
    ],
  },
  {
    title: "For Referees",
    items: [
      {
        q: "How do I join GotREFS?",
        a: "Simply create a free account, complete your profile, upload your certifications, and submit your verification package.",
      },
      {
        q: "Is there a cost to join?",
        a: "Creating a referee account is free.",
      },
      {
        q: "How do I get verified?",
        a: "Officials can upload government-issued ID, state or national certifications, background screening documentation, and additional sport-specific credentials. Verified officials receive a digital verification card that organizers can trust. If you don't have a current verification on file, you can also use our third-party national verification partner and get verified for a small fee.",
      },
      {
        q: "Can I set my availability?",
        a: "Yes. Officials can update their availability and receive opportunities that fit their schedules.",
      },
      {
        q: "How do I find games?",
        a: "Browse available events, tournaments, leagues, and schools looking for officials. You can request assignments directly through the platform.",
      },
      {
        q: "Do I have to wait for assignors to contact me?",
        a: "No. Unlike traditional assigning systems, GotREFS allows officials to actively discover opportunities and request assignments themselves.",
      },
      {
        q: "How do I get paid?",
        a: "Payments are processed securely through the platform, eliminating paper checks and reducing payment delays.",
      },
    ],
  },
  {
    title: "For Event Organizers",
    items: [
      {
        q: "How does GotREFS help me find officials?",
        a: "Post your event, specify your sport and staffing needs, and receive requests from qualified, verified, and rated officials. You can review credentials and send offers directly through the platform.",
      },
      {
        q: "Why use GotREFS instead of social media or group texts?",
        bullets: [
          "Verified officials",
          "Background screening visibility",
          "Certification verification",
          "Centralized communication",
          "Rated officials",
          "Assignment tracking",
          "Reduced staffing time",
          "No more Facebook posts, mass texts, or endless phone calls",
        ],
      },
      {
        q: "Can I view referee certifications before hiring?",
        a: "Yes. Organizers can review referee qualifications, certifications, verification status, ratings, and eligibility before making offers.",
      },
      {
        q: "How quickly can I staff an event?",
        a: "Many organizers can post an event, receive requests, and begin making offers within minutes instead of spending days or weeks recruiting officials.",
      },
      {
        q: "Can I hire officials for a single event?",
        a: "Absolutely. GotREFS works for one-day tournaments, weekend events, seasonal leagues, and year-round programs.",
      },
    ],
  },
  {
    title: "Verification & Safety",
    items: [
      {
        q: "Are officials background checked?",
        a: "Verified officials complete background screening requirements as part of the verification process, and we also use a national verification partner for officials who need to complete screening. Some officials might not have verification yet — that will show on their profile. Event organizers can choose whether they want verified or non-verified officials when posting an event.",
      },
      {
        q: "What does the Verified Badge mean?",
        a: "The badge indicates that an official has completed identity verification and submitted the required documentation for review.",
      },
      {
        q: "Can organizers hire only verified officials?",
        a: "Yes. Organizers can choose to work exclusively with verified officials, or include officials who are not yet verified.",
      },
    ],
  },
  {
    title: "Platform Features",
    items: [
      {
        q: "Does GotREFS replace my assignor?",
        a: "No. Assignors remain valuable. GotREFS provides an additional staffing marketplace that helps assignors and organizers fill difficult games faster.",
      },
      {
        q: "Can I manage multiple events?",
        a: "Yes. Organizers can manage multiple leagues, tournaments, and facilities from a single dashboard.",
      },
      {
        q: "Does GotREFS provide real-time event management?",
        a: "Yes. Organizers can track staffing needs, referee requests, offers, and confirmations through a centralized dashboard.",
      },
      {
        q: "Is customer support available?",
        a: "Yes. GotREFS provides support for both organizers and officials.",
      },
    ],
  },
  {
    title: "Pricing",
    items: [
      {
        q: "Is GotREFS free for referees?",
        a: "Yes. Referees can create an account and participate in the marketplace at no cost.",
      },
      {
        q: "Is GotREFS free for event organizers?",
        a: "Event organizers can create accounts, post events, and access the platform. If they want to connect and hire GotREFS personnel, a small service fee applies to each hire.",
      },
      {
        q: "How does GotREFS make money?",
        a: "Optional verification services, premium features, and marketplace-related transaction fees help support the platform while keeping access affordable for the officiating community.",
      },
    ],
  },
  {
    title: "Why GotREFS?",
    items: [
      {
        q: "What makes GotREFS different?",
        bullets: [
          "Nationwide referee marketplace",
          "Verified and background-checked officials",
          "Officials are rated by event organizers from previous events",
          "Multi-sport platform",
          "50-state coverage",
          "Faster staffing and hiring",
          "Secure payments",
          "Real-time availability and event management",
          "Built specifically for youth, amateur, and scholastic sports",
        ],
      },
      {
        q: "What is the mission of GotREFS?",
        a: "To make it easier for sports organizers to find qualified officials and easier for referees to find games — creating a trusted marketplace that helps grow officiating across every sport and every community.",
      },
    ],
  },
];
