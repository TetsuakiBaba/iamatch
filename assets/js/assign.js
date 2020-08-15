// CSV用途データ整形
/*
function formatInput(data) {
    let students = []
    const lines = data.split('\n');
    lines.shift(); // 見出し行は破棄
    let index = 0;
    lines.forEach(tokens => {
      if (tokens.length == 0) {
        return;
      }
      const elements = tokens.split(',')
      let student = {
        id:     index,       // エントリーID
        name:   elements[6], // 氏名
        gpa:    elements[7], // 通算GPA
        status: 0,           // 仮配属研究室ID（0: 処理中、-1: 未決定、string: 研究室名）
        entry:  []           // 志望スタジオ情報
      };
      for (let e = 8; e + 1 < elements.length; e += 2)
      {
        const pref = {
          lab:   elements[e],    // 研究室名
          point: elements[e + 1] // ポイント
        };
        student.entry.push(pref);
      }
      students.push(student);
      ++index;
    });
    return students;
  }
*/
// 配属ループ修了判定ヘルパー
function checkTerminal(students) {
    for (let s = 0; s < students.length; ++s) {
        if (students[s].status == 0) {
            return false;
        }
    }
    return true;
}

// 以降、しばらくファイルまわりのアレコレ
const form = document.forms.student;
const resultElement = document.getElementById('result');
form.student.addEventListener('change', function (event) {
    const fileInfo = event.target.files[0];
    const reader = new FileReader();
    reader.readAsText(fileInfo);

    reader.addEventListener('load', function () {
        // 研究室リスト
        const labs = {
            "Editorial": { slots: 4, applicants: [] },
            "EquipmentService": { slots: 4, applicants: [] },
            "Ergonomic": { slots: 2, applicants: [] },
            "InteractiveArt": { slots: 3, applicants: [] },
            "Interface": { slots: 1, applicants: [] },
            "Interior": { slots: 1, applicants: [] },
            "Kinematograph": { slots: 1, applicants: [] },
            "Network": { slots: 1, applicants: [] },
            "Software": { slots: 1, applicants: [] },
            "Spatial": { slots: 1, applicants: [] },
            "Transportation": { slots: 1, applicants: [] },
            "VisualCommunication": { slots: 1, applicants: [] }
        };
        // 配属アルゴリズム本体
        // エクセルファイルを読み込んで，読み込み成功なら処理をすすめる
        readXlsxFile(fileInfo).then(function (rows) {
            let students = []

            // エクセルテーブルを連想配列に準備
            for (let i = 1; i < rows.length; i++) {
                const elements = rows[i];
                let student = {
                    id: i - 1, // エントリーID
                    name: elements[5],
                    gpa: elements[6],
                    status: 0,
                    entry: []
                }
                for (let e = 7; e < elements.length; e += 2) {
                    const pref = {
                        lab: elements[e],    // 研究室名
                        point: elements[e + 1] // ポイント
                    };
                    student.entry.push(pref);
                }
                students.push(student);
            }

            // 全員が仮配属か未決定になるまでループ
            while (!checkTerminal(students)) {
                // 現時点で希望するスタジオにエントリー
                students.forEach(student => {
                    let name;
                    if (student.entry.length > 0) {
                        name = student.entry[0].lab;
                    }
                    else {
                        window.confirm(student.id);
                    }
                    labs[name].applicants.push({
                        id: student.id,
                        gpa: student.gpa,
                        point: student.entry[0].point
                    });
                });
                for (let [name, data] of Object.entries(labs)) {
                    // ポイント&GPA順に降順ソート
                    data.applicants.sort(function (x, y) {
                        if (y.point != x.point) {
                            return y.point - x.point;
                        }
                        return y.gpa - x.gpa;
                    });
                    // 仮配属処理
                    const numApplicants = data.applicants.length;
                    let a = 0;
                    for (; a < data.slots && a < numApplicants; ++a) {
                        const sid = data.applicants[a].id;
                        students[sid].status = name;
                    }
                    // 落選者処理
                    for (; a < numApplicants; ++a) {
                        // 志望を繰り下げ
                        const sid = data.applicants[a].id;
                        students[sid].status = 0;
                        students[sid].entry.shift();
                        // 志望先がなくなったら未決定状態に
                        if (students[sid].entry.length <= 0) {
                            students[sid].status = -1;
                        }
                    }
                    data.applicants = [] // 志望者リストのクリア
                }
            }
            let displayElement = '';
            students.forEach(s => {
                displayElement += '<tr>';
                displayElement += `<td>${s.name}</td>`;
                displayElement += `<td>${s.status}</td>`;
                displayElement += '</tr>';
            });
            resultElement.innerHTML = displayElement;
        });


    });
});