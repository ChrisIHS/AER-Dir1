import Link from "next/link";

export const metadata = { title: "How to use CORE SSLA" };

/**
 * User guide. KEEP IN SYNC with the app: when a screen, rule or role changes, change this page too.
 * src/app/help/help.test.ts fails if a validation rule is missing from the rules table below.
 */
const SECTIONS = [
  ["overview", "What this is"],
  ["roles", "Who does what"],
  ["start", "Getting started"],
  ["steps", "The workflow, step by step"],
  ["workstreams", "The seven workstreams"],
  ["issues", "Understanding the checks"],
  ["tracker", "The completeness tracker"],
  ["library", "Rate sheets and the library"],
  ["package", "Forms and the submission package"],
  ["faq", "Questions"],
  ["limits", "What the app does not do"],
] as const;

type Rule = [id: string, req: string, how: string, level: "Blocks" | "Warning" | "Note"];

const RULES: Rule[] = [
  ["V-01", "Req. 4", "Tick the \"no net present value, discounting or escalation\" box on each workstream that has costs, and leave discount or escalation rates empty.", "Blocks"],
  ["V-02", "Req. 12", "No salvage or resale credit and no negative amounts. Scrap metal is entered as a positive value on the Ferrous / Nonferrous Material Value rows.", "Blocks"],
  ["V-03", "Req. 12, 58(j)", "A scrap-metal value needs a supporting document (for example the recycler's price list) and a linked rate sheet.", "Blocks"],
  ["V-04", "Req. 3, 58(j)", "Every unit rate needs a linked, uploaded rate sheet and the page or line it comes from. Percentage lines and contingencies are exempt.", "Blocks"],
  ["V-05", "Req. 3", "A rate sheet marked client-specific or multi-site discount can't be used. Use undiscounted published rates (discounts available to everyone are fine).", "Blocks"],
  ["V-06", "Req. 3", "The rate sheet is undated or older than 12 months. Rates must be current-day.", "Warning"],
  ["V-07", "Req. 29", "Enter the excavation-bulking factor. Typical range is 1.2 to 1.4; outside it you must justify the deviation. Also say how you arrived at it.", "Blocks"],
  ["V-08", "Req. 8", "Cost at least three years of reasonable care and measures AND three years of site security, in year, month, week or day units. This workstream can't be marked not applicable.", "Blocks"],
  ["V-09", "Req. 11", "For pipelines, list each segment and say whether it is abandoned in place or removed.", "Blocks"],
  ["V-10", "Req. 17, 19, 58(d)", "Remediation costs need the OneStop submission ID of the Phase 1 ESA.", "Blocks"],
  ["V-11", "Req. 37", "A Tier 2 approach needs the OneStop submission ID of the Tier 2 assessment work.", "Blocks"],
  ["V-12", "Req. 21, 34", "APECs need a Phase 2 ESA ID. The exception is restricted access: declare it, give the rationale and cost a restricted-access contingency (this then shows as a warning).", "Blocks"],
  ["V-13", "Req. 17, 58(d)", "Add the Record of Site Condition OneStop ID when one exists.", "Warning"],
  ["V-14", "Req. 43(c), 44", "If soil goes off site, cost backfill import. Keep backfill import separate from overburden and topsoil handling: separate lines, separate form rows.", "Blocks"],
  ["V-15", "Req. 5", "Management and administration items (a) to (k) must each be costed, or have a written reason for zero. Item (k) is the general contingency.", "Blocks"],
  ["V-16", "Req. 5(k), 20, 26, 34(a), 49", "Contingencies are separate lines of a stated type, each with a rationale. A declared condition (missing history, unevaluated issues, restricted access) needs its own contingency line.", "Blocks"],
  ["V-17", "Req. 28, 31", "Give the plume irregularity factor and its basis, and upload the site drawing showing affected areas and sample points.", "Blocks"],
  ["V-18", "Req. 32, 33", "For off-site disposal, give soil density, moisture content and how you determined them.", "Blocks"],
  ["V-19", "Req. 24, 39(b), 40-42, 45", "State whether soil is treated on site, disposed of off site, or both, and fill in the supporting details for any on-site treatment, remediation system, groundwater or in-place work.", "Blocks"],
  ["V-20", "Req. 14, 15", "Oilfield landfills only have to meet Req. 14 for remediation and reclamation. The remediation and reclamation checks are skipped.", "Note"],
  ["V-21", "Req. 47", "Tick which of the reclamation plan elements (a) to (j) it covers.", "Warning"],
  ["V-24", "Form 001-A note", "Tonnes demolished should roughly equal tonnes disposed plus tonnes scrapped (within 10%).", "Warning"],
];

const SIGNOFF_RULES: Rule[] = [
  ["V-22", "Req. 48, 51-53", "Before signing: the assessment date, the limiting-conditions section, the personnel table and the assessor's credentials with good standing attested.", "Blocks"],
  ["V-23", "Req. 54-57", "The lead assessor ticks the three statements (certification, signatory statement, AER and AEPA as authorized users).", "Blocks"],
  ["V-25", "Req. 17", "Remedial action plans and contamination management reports must not be in the package. Cite their OneStop IDs instead.", "Blocks"],
];

function RuleTable({ rows }: { rows: Rule[] }) {
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr><th>Check</th><th>Requirement</th><th>What to do</th><th>Effect</th></tr>
        </thead>
        <tbody>
          {rows.map(([id, req, how, level]) => (
            <tr key={id}>
              <td className="mono">{id}</td>
              <td>{req}</td>
              <td>{how}</td>
              <td>{level === "Blocks" ? "Blocks submission" : level}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HelpPage() {
  return (
    <>
      <h1>How to use CORE SSLA</h1>
      <p className="sub">
        A guide for licensees, contractors, lead assessors and the officers who sign. Directive 001 requirement numbers are shown as &ldquo;Req. n&rdquo; so you can check any rule against the Directive.
      </p>

      <nav aria-label="On this page" className="card toc">
        <strong>On this page</strong>
        <ul>
          {SECTIONS.map(([id, title]) => (
            <li key={id}><a href={`#${id}`}>{title}</a></li>
          ))}
        </ul>
      </nav>

      <h2 id="overview">What this is</h2>
      <p>
        CORE SSLA collects the information an Alberta licensee needs for a <strong>site-specific liability assessment (SSLA)</strong> under AER Directive 001 (February 2025). Contractors enter their costs and evidence, a lead assessor reviews and signs, and the licensee exports the AER&apos;s own cost forms and a submission package to email to <strong>ssla@aer.ca</strong>.
      </p>
      <ol>
        <li>The licensee creates a <strong>site</strong> and gives other organizations access.</li>
        <li>Work is split into seven <strong>workstreams</strong>, each assigned to a contractor (or done in-house).</li>
        <li>Each workstream is checked live against the Directive. You can always save a draft; <em>submitting</em> needs every blocking check cleared.</li>
        <li>A reviewer returns a workstream for changes or approves it.</li>
        <li>When everything is approved, the <strong>lead assessor signs</strong> two acknowledgement statements and the assessment locks.</li>
        <li>A <strong>senior officer</strong> of the licensee signs the Liability Declaration.</li>
        <li>The licensee builds the <strong>package</strong> and sends it to the AER.</li>
      </ol>
      <p className="sub">Every organization&apos;s data is separate. Others see a site only after the licensee gives them access, and a contractor sees only the workstreams assigned to them.</p>

      <h2 id="roles">Who does what</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>Role</th><th>How you get it</th><th>You can</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>Licensee admin</strong></td>
              <td>Create a licensee organization</td>
              <td>Create sites, give other organizations access, assign workstreams, edit any workstream, approve or return work, record the AER-system confirmations, sign the Liability Declaration, build the package, reopen a signed assessment, read the audit log.</td>
            </tr>
            <tr>
              <td><strong>Licensee member</strong></td>
              <td>Added to a licensee organization</td>
              <td>See and edit all workstreams of the licensee&apos;s sites and see totals, but not manage access, approve or build the package.</td>
            </tr>
            <tr>
              <td><strong>Contractor</strong></td>
              <td>Create a contractor organization; a licensee grants it access</td>
              <td>See and edit only the workstreams assigned to you, upload rate sheets and documents for them, comment, and submit them for review. You can&apos;t see other workstreams, totals or other contractors.</td>
            </tr>
            <tr>
              <td><strong>Lead assessor</strong></td>
              <td>Create an assessor-firm organization; a licensee grants it the lead-assessor role</td>
              <td>Read everything on the site, comment, return workstreams for changes, fill in the report details and personnel, and sign the acknowledgement statements. You must record your professional credentials first.</td>
            </tr>
            <tr>
              <td><strong>Senior officer</strong></td>
              <td>A licensee admin signs on their behalf</td>
              <td>Certifies the figures on the Liability Declaration (F035) once the assessor has signed.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="sub">One person can belong to several organizations (up to three created per account), for example a consultant who is both a contractor and an assessor firm. Use <em>Add another organization</em> at the bottom of the <Link href="/sites">Sites</Link> page.</p>

      <h2 id="start">Getting started</h2>
      <ol>
        <li><strong>Create an account</strong> on the sign-in page with your name, work email and a password of at least 10 characters. Open the confirmation email and click its link.</li>
        <li><strong>Set up your organization.</strong> Choose the type that fits: licensee (asset owner), contractor or environmental consultant, or assessor firm. Licensees can add their AER business associate (BA) ID.</li>
        <li><strong>Licensees:</strong> on the <Link href="/sites">Sites</Link> page use <em>Create a site</em>. Enter the AER licence number (leave blank if new), the legal land description, and the site type (well, facility, pipeline, or oilfield waste facility). Tick the landfill box if it is an oilfield landfill; choose the facility description for facilities.</li>
        <li><strong>Everyone else:</strong> your Sites page lists your <strong>organization ID</strong> at the bottom. Send it to the licensee so they can give you access. You will see the site once they do.</li>
      </ol>

      <h2 id="steps">The workflow, step by step</h2>

      <h3>1. Give access and assign work (licensee admin)</h3>
      <p>Open the site, then <em>Access and assignments</em>. Paste the other organization&apos;s ID, choose <em>Contractor</em> or <em>Lead assessor</em>, and click <em>Grant access</em>. Then assign each workstream to a contractor from the list. A contractor only sees what you assign them. You can remove an assignment or revoke access at any time.</p>

      <h3>2. Add rate sheets</h3>
      <p>Every unit rate must come from an uploaded, undiscounted, current-day, third-party rate sheet (Req. 3, 58(j)). Open <em>Rate sheets</em> on the site and upload the file (PDF, Word, Excel, CSV or image, up to 25 MB), with its vendor, effective date and a truthful note of any discounts. To reuse a sheet across sites, see <a href="#library">Rate sheets and the library</a>.</p>

      <h3>3. Complete each workstream</h3>
      <p>Open a workstream from the site page. Each has three parts:</p>
      <ul>
        <li><strong>Issues</strong> at the top lists every check that is failing, with its requirement number. <em>Blocks submission</em> items must be fixed to submit; warnings and notes are advice.</li>
        <li><strong>Details</strong> holds the workstream&apos;s questions (for example OneStop IDs and soil volumes for ESA and remediation). Tick the &ldquo;no net present value&rdquo; box (Req. 4). If a workstream doesn&apos;t apply to the site, untick <em>This workstream applies</em> and say why; its checks are then skipped.</li>
        <li><strong>Cost line items:</strong> one card per line. Choose the <strong>AER form row</strong> the line is reported on, a category, the task, and either <em>quantity × unit rate</em> or <em>percent × base amount</em> (type 10 for 10%). Link the <strong>rate sheet</strong> and the page or line the rate comes from. The total is calculated for you.</li>
      </ul>
      <p>You can save a draft whenever you like. Click <strong>Submit for review</strong> when the issue list shows nothing that blocks. After submitting, the workstream is locked until a reviewer returns it.</p>

      <h3>4. Review (licensee admin or lead assessor)</h3>
      <p>On a submitted workstream, <strong>Return for changes</strong> (a reason is required, and the contractor sees it) or, as licensee admin, <strong>Approve</strong>. Use the <em>Comments</em> section for questions; comments can be marked resolved. An approved workstream can still be returned if something is found later.</p>

      <h3>5. Report details and credentials (assessor or licensee admin)</h3>
      <p>Open <em>Report details</em> on the site. Enter the assessment date, the <strong>limiting conditions</strong> (any deviation from the standard or condition that limits scope or accuracy, such as missing history, snow cover, or restricted access; write &ldquo;none&rdquo; if there are none; Req. 48) and the <strong>personnel</strong> involved with their role, training and experience (Req. 51). The lead assessor records their professional designation and registration number under <Link href="/account/credentials">My credentials</Link> and attests good standing (Req. 53).</p>

      <h3>6. Sign-off (lead assessor)</h3>
      <p>Open <em>Sign-off</em>. The page lists anything still outstanding. When it says &ldquo;Nothing outstanding&rdquo;, tick the three statements, choose an acknowledgement statement and click <em>Sign statement</em>; then sign the other. Your credentials are stored with each signature. Once both are signed the assessment is <strong>locked</strong>: nothing can be edited. A licensee admin can <em>Reopen assessment</em>, which clears both signatures so changes can be made (the audit log keeps the history).</p>

      <h3>7. The senior officer&apos;s signature (licensee admin)</h3>
      <p>After the assessor has signed, the Sign-off page shows the four dollar figures and a certification. A licensee admin enters the officer&apos;s full name and position, ticks the certification, retypes the name and signs. The signature is tied to the exact figures, the licence and the date; if any of them change later it is marked <em>stale</em> and must be signed again. If the AER does not accept an electronic signature on F035, print the form from <em>Forms and package</em> and have the officer sign it by hand.</p>

      <h3>8. Confirmations, then the package (licensee admin)</h3>
      <p>On the site page, <em>Confirmations</em> records what the app can&apos;t know: that the cost forms are complete, why no extra supporting information is needed (or upload some), and the date and reference when you enter the estimate in the AER&apos;s designated system (Req. 58(k)). Then open <em>Forms and package</em>. When it says <em>Ready to build</em>, click <em>Build package (zip)</em> and download it. See <a href="#package">Forms and the submission package</a>.</p>

      <h2 id="workstreams">The seven workstreams</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>Workstream</th><th>Requirements</th><th>Enter</th></tr></thead>
          <tbody>
            <tr><td>Reasonable care, measures and site security</td><td>Req. 8</td><td>At least 3 years of care and measures and 3 years of security, in year, month, week or day units, in the categories <em>Care</em> and <em>Security</em>. Always applies.</td></tr>
            <tr><td>Suspension</td><td>Req. 9, 58(a), 58(b)</td><td>Costs to suspend the well, facility or pipeline. Upload the suspension plan (and a discontinuation plan for pipelines).</td></tr>
            <tr><td>Abandonment</td><td>Req. 10-12, 58(c)</td><td>Demolition, disposal and abandonment. Pipelines: state abandon-in-place or removed for each segment. No salvage or resale credit; scrap metal only with a supporting document. Upload the abandonment plan.</td></tr>
            <tr><td>ESA and remediation</td><td>Req. 17-45, 58(d), 58(e)</td><td>Phase 1, Phase 2 and RoSC OneStop IDs, APECs, affected volumes, bulking factor, on-site versus off-site treatment, groundwater, backfill. Don&apos;t upload remedial action plans or contamination reports: cite their OneStop IDs.</td></tr>
            <tr><td>Reclamation</td><td>Req. 46-47, 58(f)</td><td>Costs to return the land to a state eligible for a reclamation certificate; tick the plan elements (a) to (j). Upload the reclamation plan.</td></tr>
            <tr><td>Contingencies</td><td>Req. 5(k), 20, 26, 34(a), 49</td><td>One line per contingency, each a stated type (general, missing history, unevaluated issues, restricted access) with a rationale. Declare the conditions in the details.</td></tr>
            <tr><td>Management and administration</td><td>Req. 5</td><td>Items (a) to (j): planning, regulatory applications, supervision, reporting, coordination, subcontractors, equipment rental, supplies, mobilization and travel, subsistence. Tag each line with its item, or explain why an item is zero. Item (k), general contingency, goes in Contingencies.</td></tr>
          </tbody>
        </table>
      </div>
      <p className="sub">Which workstreams apply depends on the site: a well may not need ESA or reclamation work, for example. Mark a workstream not applicable with a reason rather than leaving it empty.</p>

      <h2 id="issues">Understanding the checks</h2>
      <p>Checks run as you work and name the Directive requirement behind each one. <strong>Blocks submission</strong> means the workstream can&apos;t be submitted, approved, signed or packaged until it is fixed. Warnings and notes never block. You can save drafts regardless.</p>
      <RuleTable rows={RULES} />
      <h3>At sign-off and packaging</h3>
      <RuleTable rows={SIGNOFF_RULES} />

      <h2 id="tracker">The completeness tracker</h2>
      <p>The site page shows each item the AER requires in a complete SSLA (Req. 58 a to k) with an owner and a colour:</p>
      <ul>
        <li><strong>Complete</strong> (green): present, valid and approved.</li>
        <li><strong>In progress</strong> (amber): present but waiting for approval or with warnings.</li>
        <li><strong>Missing</strong> (red): not there yet, or blocked by a failing check.</li>
        <li><strong>N/A</strong>: doesn&apos;t apply to this site (for example, the discontinuation plan for a well).</li>
      </ul>
      <p>The <Link href="/sites">Sites</Link> page rolls this up across all your sites into stages (setting up, in progress, in review, ready for sign-off, signed, package built), with the estimate, open issues and the next action for each. It can be downloaded as a CSV. Contractors see their own work queue instead.</p>

      <h2 id="library">Rate sheets and the library</h2>
      <p>The <Link href="/library">Rate library</Link> keeps your organization&apos;s rate sheets in one place, visible only to your organization. Use <em>Use</em> next to a sheet to <strong>copy it onto a site</strong>. It is copied, not linked, so the package for that site stays self-contained and the rates it cites can&apos;t change later. Replace library sheets when newer ones are published: sheets over 12 months old are flagged, and a line that uses a stale or discounted sheet is flagged on the site.</p>

      <h2 id="package">Forms and the submission package</h2>
      <p>Under <em>Forms and package</em> you can download, at any time (marked DRAFT until both statements are signed):</p>
      <ul>
        <li><strong>Forms 001-A and 001-B</strong>: the AER&apos;s own Excel workbook, filled in. Several lines on one form row are combined so the form&apos;s formula gives the exact total.</li>
        <li><strong>Liability Declaration (F035)</strong>: the AER PDF, with the officer&apos;s signature block filled once they have e-signed.</li>
        <li><strong>Acknowledgement statements</strong>: the AER Word document, with the check boxes ticked for signed statements.</li>
        <li><strong>Itemized cost schedule</strong>: every line with its rate source and page; contingencies stay separate (the AER forms have a single contingency row).</li>
      </ul>
      <p>The <strong>package zip</strong> adds your plans, supporting documents and every rate sheet, a README listing the Req. 58 status, and a manifest with file hashes. It can be built only when every item the package needs is complete and no blocked document (remedial action plan, contamination report) is attached.</p>
      <h3>Before you send it to ssla@aer.ca</h3>
      <ol>
        <li>The senior officer signs the Liability Declaration (by e-signature here, or by hand on the printed form).</li>
        <li>The lead assessor applies their <strong>professional stamp or seal</strong> and signature to the report and the acknowledgement statements. The app records the sign-off but does <em>not</em> apply a stamp (Req. 54, 55). There is an upload slot on the Sign-off page for the stamped pages.</li>
        <li>Enter the estimate in the AER&apos;s designated information submission system (Req. 58(k)) and record the date and reference on the site page.</li>
        <li>Email the package to ssla@aer.ca.</li>
      </ol>

      <h2 id="faq">Questions</h2>
      <div className="card">
        <details>
          <summary>Why can&apos;t I edit a workstream?</summary>
          <p>Workstreams lock when submitted or approved, and the whole assessment locks after both statements are signed. Ask a reviewer to return the workstream, or a licensee admin to reopen the assessment. You also need to be a licensee member or the assigned contractor: otherwise you have read-only access.</p>
        </details>
        <details>
          <summary>Why can&apos;t I submit?</summary>
          <p>One or more checks under <em>Issues</em> say &ldquo;Blocks submission&rdquo;. Each shows its requirement number and what to fix. Warnings don&apos;t stop you.</p>
        </details>
        <details>
          <summary>A check says my rate sheet isn&apos;t linked, but I uploaded it.</summary>
          <p>Uploading isn&apos;t enough: open the line and choose the rate sheet in <em>Rate sheet</em>, and fill in the page or line it comes from. Percentage lines and contingencies don&apos;t need one.</p>
        </details>
        <details>
          <summary>How do I give a contractor or assessor access?</summary>
          <p>Ask them for their organization ID (at the bottom of their Sites page). In <em>Access and assignments</em>, paste it, choose the role and grant access; then assign workstreams. There are no email invitations yet.</p>
        </details>
        <details>
          <summary>Who can see my data?</summary>
          <p>Only members of your organization and organizations you give access to a site. Contractors see only the workstreams assigned to them, and never other contractors&apos; work. Every change is recorded in the audit log (visible to the licensee admin and the lead assessor).</p>
        </details>
        <details>
          <summary>Can I change something after signing?</summary>
          <p>Yes. A licensee admin reopens the assessment from the Sign-off page. That clears both assessor signatures; the senior officer&apos;s signature becomes stale if any certified figure changes. Everything is re-signed after the change.</p>
        </details>
        <details>
          <summary>My site is an oilfield landfill. What changes?</summary>
          <p>Tick the landfill box when creating the site. Only Req. 14 applies to remediation and reclamation (Req. 15), so those checks are skipped, and the ESA items show as not applicable in the tracker. Follow Directive 058 and the Standards for Landfills in Alberta for those costs.</p>
        </details>
        <details>
          <summary>Where do I record that I entered the estimate in the AER&apos;s system?</summary>
          <p>On the site page, under <em>Confirmations</em> (Req. 58(k)).</p>
        </details>
        <details>
          <summary>What file types can I upload?</summary>
          <p>PDF, Word, Excel, CSV and images (PNG, JPG), up to 25 MB each.</p>
        </details>
      </div>

      <h2 id="limits">What the app does not do</h2>
      <ul>
        <li>It does <strong>not submit anything to the AER</strong>. You email the package and enter the estimate in the AER&apos;s own system.</li>
        <li>It does <strong>not apply a professional stamp or seal</strong>. Stamping is the lead assessor&apos;s responsibility.</li>
        <li>Whether the AER accepts an <strong>electronic signature</strong> on the Liability Declaration is for you to confirm. If not, sign a printed copy.</li>
        <li>It is a tool for assembling an SSLA, not a substitute for professional judgment or for reading Directive 001. The checks catch many omissions but can&apos;t tell whether a figure is right.</li>
        <li>Access is granted by organization ID; there are no email invitations or notifications yet.</li>
      </ul>
      <p className="sub"><Link href="/sites">← Back to Sites</Link></p>
    </>
  );
}
