/** Decorative, code-native illustrations; these are not historical photographs. */
export default function ArchiveArtwork({ kind, className = "" }: { kind: string; className?: string }) {
  const strokes = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden="true" className={"archive-artwork " + className} viewBox="0 0 640 320" fill="none">
      <g opacity=".15" stroke="currentColor" strokeWidth=".8">
        {[70, 130, 190, 250].map((y) => <path key={y} d={"M0 " + y + "H640"} />)}
        {[80, 160, 240, 320, 400, 480, 560].map((x) => <path key={x} d={"M" + x + " 0V320"} />)}
      </g>
      <circle cx="462" cy="108" r="76" fill="currentColor" opacity=".08" />
      <circle cx="462" cy="108" r="91" stroke="currentColor" opacity=".18" strokeDasharray="3 8" />
      {kind === "method" && <g {...strokes}>
        <path d="M155 95Q225 73 303 108V263Q225 228 155 251ZM303 108Q383 72 451 95V251Q376 229 303 263" fill="currentColor" fillOpacity=".05" strokeWidth="2.5" />
        <path d="M173 78Q230 65 291 88M315 88Q374 63 432 77M178 126Q222 116 273 134M178 148Q225 141 273 156M178 170Q223 162 273 179M178 192Q223 184 273 201M333 133Q378 116 421 125M333 156Q378 141 421 148M333 179Q378 162 421 170" opacity=".65" />
        <circle cx="448" cy="194" r="42" strokeWidth="3" /><circle cx="448" cy="194" r="33" opacity=".4" /><path d="m478 224 43 43" strokeWidth="10" />
        <path d="M117 275H522M303 269v14" opacity=".45" />
      </g>}
      {kind === "road" && <g {...strokes}>
        <path d="M29 261 153 106 255 229 354 62 532 263 604 174 650 251" fill="currentColor" fillOpacity=".05" strokeWidth="2.5" />
        <path d="m129 137 24-31 29 35 18-5M315 126l39-64 54 61-30-13-20 12-17-18M57 278 166 151 254 256M274 254l79-147 125 169" opacity=".45" />
        <path d="M200 320c-24-40 109-48 123-83s-22-31-9-61 43-37 40-60" strokeWidth="3" strokeDasharray="5 8" />
        <circle cx="355" cy="109" r="7" fill="currentColor" /><circle cx="208" cy="302" r="7" fill="currentColor" />
        <path d="M62 291H579" opacity=".3" />
      </g>}
      {kind === "transform" && <g {...strokes}>
        <path d="M48 268c157-91 328-87 550 0M48 284c157-83 328-78 550 0M115 303c139-71 298-65 437-1M173 314c105-53 213-44 320 0" strokeWidth="2" />
        <path d="M115 233V166l60-38 61 38v45M98 176l77-52 80 53M150 218v-43h42v40M356 220V138l92-52 92 52v104M340 148l108-64 109 64M384 225v-64h38v62M460 123h30v26h-30ZM477 183h34v34h-34Z" strokeWidth="2" fill="currentColor" fillOpacity=".05" />
        <path d="M267 219V141m0 43c-23 0-31-13-29-25 23 0 31 12 29 25Zm0-16c23 0 31-13 29-25-23 0-31 12-29 25Z" strokeWidth="2" />
      </g>}
      {kind === "industry" && <g {...strokes}>
        <path d="M53 280h537M99 280V149l71-36v36l71-36v36l71-36v167M360 280V78h31v202M354 78h43M473 280V103h27v177M467 103h38M313 192h222v88" strokeWidth="2.5" fill="currentColor" fillOpacity=".05" />
        {[128, 189, 250, 343, 420, 492].map((x) => <path key={x} d={"M" + x + " 214h24v30h-24Z"} opacity=".65" />)}
        <path d="M379 58c-40-13-6-40 24-29 10-29 68-25 68-4 27-5 44 7 44 26M486 88c-13-10-5-28 15-26" strokeDasharray="4 7" opacity=".5" />
      </g>}
      {kind === "reform" && <g {...strokes}>
        <path d="M48 278h555M94 278V166h51v112M167 278V118h66v160M255 278V59h63v219M277 59V36M337 278V144h48v134M408 278V101h67v177M496 278V181h47v97" strokeWidth="2" fill="currentColor" fillOpacity=".05" />
        <path d="M267 86h38m-38 22h38m-38 22h38m-38 22h38m-38 22h38M180 142h40m-40 23h40m-40 23h40M421 127h40m-40 24h40m-40 24h40" opacity=".45" />
        <path d="M54 216c84-63 132 41 221-19s128 19 262-132m-4 39 4-39-39 4" strokeWidth="3" strokeDasharray="6 7" />
      </g>}
      {kind === "people" && <g {...strokes}>
        <circle cx="323" cy="112" r="27" strokeWidth="2.5" /><circle cx="199" cy="171" r="22" strokeWidth="2" /><circle cx="447" cy="171" r="22" strokeWidth="2" />
        <path d="M269 225v-31c0-64 108-64 108 0v31M155 263v-32c0-49 88-49 88 0v32M403 263v-32c0-49 88-49 88 0v32M282 263h81M273 107l-39 22m138-22 39 22M249 245h31m85 0h31" strokeWidth="2.5" />
        <circle cx="323" cy="173" r="114" strokeDasharray="4 9" opacity=".35" />
        <path d="M101 283h439M119 74h32m-16-16v32M515 111h26m-13-13v26" opacity=".4" />
      </g>}
      {kind === "development" && <g {...strokes}>
        <path d="M303 277V122M303 226c-89 1-134-53-139-106 89 0 139 42 139 106ZM305 172c2-83 52-122 118-118-1 76-52 116-118 118ZM305 253c9-68 57-95 117-87-12 69-62 98-117 87Z" strokeWidth="2.5" fill="currentColor" fillOpacity=".07" />
        <path d="m303 226-96-78m98 23 82-82m-82 164 83-61M80 283c71-24 123 20 186 0s117-17 172 0 73 5 122-9" opacity=".65" strokeWidth="2" />
        <circle cx="486" cy="104" r="19" opacity=".5" /><path d="M120 221h31m-16-16v32" opacity=".4" />
      </g>}
      <path d="M38 44V28h17M585 28h17v16M38 283v16h17M585 299h17v-16" stroke="currentColor" opacity=".4" />
    </svg>
  );
}
