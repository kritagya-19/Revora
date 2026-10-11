## Remainder Feature Flow 


flowchart TD
    A["Collect Customer Signals<br/>CRM · Email · Calendar · Product Usage"]
    B["Signal Senses Agent<br/>Analyze signals and calculate risk"]
    C{"Customer at Risk?"}

    A --> B --> C
    C -- No --> D["Continue Normal Monitoring"]
    D --> A

    C -- Yes --> E["Create Retention Plan"]
    E --> F["Identify Risk Reason<br/>Low Usage · Low Engagement<br/>UX Issues · Renewal Risk"]
    
    F --> G["Retention Reminder Agent"]
    G --> H["Select Relevant Content<br/>Product Updates · New Features<br/>Useful Offers · Approved Discounts"]
    H --> I["Check Relevance<br/>Communication Preferences<br/>Offer Approval and Eligibility"]
    I --> J["Send Personalized Reminder<br/>Email or Supported Channel"]

    F --> K["Feedback Form Agent"]
    K --> L["Generate and Send Feedback Form"]
    L --> M["Wait 48 Hours"]
    M --> N{"Feedback Received?"}

    N -- Yes --> O["Analyze Feedback<br/>Sentiment and Root Cause"]
    N -- No --> P["Send Reminder Email"]
    P --> Q["Wait Another 48 Hours"]
    Q --> R{"Feedback Received Now?"}

    R -- Yes --> O
    R -- No --> S["Notify Sales Team<br/>Customer Call Required"]

    O --> T{"Feedback Outcome?"}
    T -- Positive --> U["Mark Customer Healthy<br/>Update CRM and Monitor"]
    T -- Negative --> V["Identify Customer Problems<br/>UX · Product · Pricing<br/>Competitor · Support"]
    
    V --> W["Notify Sales Team<br/>Prepare Customer Call"]
    V --> X["Notify Manager<br/>Share Feedback Insights"]
    V --> Y["Retention Reminder Agent<br/>Choose a Relevant Response"]
    
    Y --> Z["Prepare Personalized Recovery Message<br/>Relevant Update, Feature or<br/>Approved Offer"]
    Z --> AA{"Human Approval Required?"}
    AA -- Yes --> AB["Manager or Authorized Person<br/>Reviews and Approves"]
    AB --> AC{"Approved?"}
    AC -- Yes --> AD["Send Recovery Message"]
    AC -- No --> AE["Revise or Cancel Message"]
    AA -- No --> AD

    S --> AF["Update CRM<br/>Record Non-response and Escalation"]
    W --> AG["Record Sales Follow-up"]
    X --> AH["Record Product or UX Insights"]
    AD --> AI["Track Customer Engagement<br/>Usage · Reply · Account Health"]
    AI --> AJ{"Risk Reduced?"}
    AJ -- Yes --> U
    AJ -- No --> AK["Continue Appropriate Follow-up<br/>Sales Intervention or Support"]
    AK --> AF

    classDef source fill:#E8F2FF,stroke:#4682D8,color:#102A56
    classDef agent fill:#EDE9FF,stroke:#8065D8,color:#30205B
    classDef decision fill:#FFF2CC,stroke:#D6A62E,color:#553D00
    classDef positive fill:#DDF7E5,stroke:#35A65A,color:#124B28
    classDef negative fill:#FFE3E3,stroke:#E5484D,color:#751C24
    classDef action fill:#E4F3FF,stroke:#2684C7,color:#103D63

    class A source
    class B,G,K,O,Y agent
    class C,N,R,T,AA,AC,AJ decision
    class D,U positive
    class V,W,X,S,AF,AK negative
    class E,F,H,I,J,L,M,P,Q,Z,AB,AD,AE,AG,AH,AI action
