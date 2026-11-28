// コースの形（`data/raceCourseShapes.js`）を出典の記述と突き合わせる（`devlog/wave16.md`§6）。
// ①1周の5区間の和が周長に一致するか ②「最初のコーナーまで○m」の記述と、組み立てたコーナーの位置の差
// ③全レース（各場の施行距離）のコーナーの数・角度の合計・最後のコーナーの出口（＝距離−最後の直線か）。
// 使い方： node tools/check-course-shapes.mjs [courseId]
import { courseShapeFor, COURSE_LAYOUTS, COURSE_START_FACTS } from "../src/data/raceCourseShapes.js";
import { JRA_COURSES } from "../src/data/courses.js";

const only = process.argv[2];
const deg = (r) => Math.round((r * 180) / Math.PI);

console.log("1周の形（周長＝F+C12+B+C34+S か）");
for (const [key, l] of Object.entries(COURSE_LAYOUTS)) {
  if (only && !key.startsWith(only)) continue;
  console.log(
    `  ${key.padEnd(22)} 周長${String(l.lap).padStart(7)}  F${l.F.toFixed(1).padStart(6)} C12${l.C12.toFixed(1).padStart(7)} B${l.B.toFixed(1).padStart(7)} C34${l.C34.toFixed(1).padStart(7)} S${String(l.S).padStart(6)}  ${l.closes ? "閉じる" : "⚠️閉じない"}  仮:${(l.provisional ?? []).join(",")}`
  );
}

console.log("\n出典の「最初のコーナーまで」との突き合わせ");
for (const [key, f] of Object.entries(COURSE_START_FACTS)) {
  if (only && !key.startsWith(only)) continue;
  const [c, s, d] = key.split(":");
  const shape = courseShapeFor(c, s, Number(d));
  const first = shape.corners[0];
  const got = first ? first.from : null;
  const diff = f.firstCornerAt != null && got != null ? (got - f.firstCornerAt).toFixed(1) : "-";
  console.log(
    `  ${key.padEnd(20)} ${shape.loop.padEnd(6)} 出典${String(f.firstCornerAt ?? "-").padStart(7)}  組み立て${got == null ? "   なし" : got.toFixed(1).padStart(7)}（${first ? first.corner + "角" : ""}） 差${String(diff).padStart(7)}  ${f.src}`
  );
}

console.log("\n全レースの形（コーナー：開始〜終了(番号・角度)）");
for (const course of JRA_COURSES) {
  if (only && course.id !== only) continue;
  for (const surface of ["turf", "dirt"]) {
    for (const d of course.profile[surface]) {
      const sh = courseShapeFor(course.id, surface, d);
      const total = sh.corners.reduce((a, c) => a + c.angle, 0);
      const last = sh.corners[sh.corners.length - 1];
      const exitOk = !last || Math.abs(last.to - (d - sh.finalStraight)) < 0.5;
      console.log(
        `  ${course.id}:${surface}:${d} ${sh.loop} 角度計${deg(total)}° ${exitOk ? "" : "⚠️最後の出口が直線と合わない "}${sh.provisional.length ? "仮[" + sh.provisional.join(",") + "] " : ""}` +
          sh.corners.map((c) => `${c.from.toFixed(0)}〜${c.to.toFixed(0)}(${c.corner}・${deg(c.angle)}°)`).join(" ")
      );
    }
  }
}
