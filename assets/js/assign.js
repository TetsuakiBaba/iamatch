const form = document.forms.student;

function updateSlots() {
    let sum_of_capacity = 0;
    // html上の配属人数でオブジェクトデータの配属人数を更新する
    for (let i = 0; i < labs.length; i++) {
        labs[i].slots = labs[i].element_slots.value();
        sum_of_capacity = sum_of_capacity + int(labs[i].slots);
    }
    return sum_of_capacity;
}

// 配属ループ終了判定ヘルパー
function checkTerminal(students) {
    for (let s = 0; s < students.length; ++s) {
        if (students[s].status == "") {
            return false;
        }
    }
    return true;
}

const resultElement = document.getElementById('result');
const statisticsElement = document.getElementById('result_statistics');
let fileInfo;
let reader;

var g_students;

// 実行ボタンで呼び出される．呼び出しはui.jsから行われます
async function assign() {
    try {
        let privacy_mode = document.getElementById('privacy_mode').checked;

        updateSlots();
        for (let i = 0; i < labs.length; i++) {
            labs[i].element_assigned.value(0);
            labs[i].number_assigned = 0;
        }

        // 配属アルゴリズム本体
        // エクセルファイルを読み込んで，読み込み成功なら処理をすすめる
        let numSlots = 0;
        labs.forEach(lab => {
            numSlots += int(lab.slots);
        });

        const rows = await readXlsxFile(fileInfo);

        // エクセルテーブルをオブジェクトに準備
        // Google Spreadsheet format
        // 0: タイムスタンプ
        // 1: メールアドレス
        // 2: 学習番号
        // 3: 氏名
        // 4: GPA
        // 5: 単位取得数
        // 6+n*2: 研究室の希望数値（第何希望なのか？）
        // 6+n*2+1: 研究室履修ポイント

        let number_of_studio = labs.length;
        let data_position = {
            timestamp: 0,
            email: 1,
            number: 2,
            name: 3,
            gpa: 4,
            credits: 5,
            studio: 6,
            studio_score: 6 + 1
        };

        let students = []
        let entriedStudents = [];
        for (let i = 1; i < rows.length; i++) {
            const elements = rows[i];
            let student = {
                id: entriedStudents.length, // エントリーID
                name: elements[data_position.name], // 氏名
                gpa: parseFloat(elements[data_position.gpa]), // GPA
                units: parseInt(elements[data_position.credits]), // 取得単位数
                status: "", // 仮配属ステータス
                entry: [], // 志望研究室
                entry_original: [] // 志望研究室保存用
            }
            for (let l = 0; l < number_of_studio; ++l) {
                const pref = {
                    lab: labs[l].name, // 研究室名
                    priority: parseInt(elements[(l * 2) + 6]), // 志望順
                    point: parseInt(elements[(l * 2) + 6 + 1]), // ポイント
                };
                student.entry.push(pref);
                student.entry_original.push(pref);
            }
            // 志望順位でソート
            student.entry.sort(function (x, y) {
                return x.priority - y.priority;
            });
            // 志望順位でソート
            student.entry_original.sort(function (x, y) {
                return x.priority - y.priority;
            });
            // 複数回応募している場合は既登録内容を上書き
            const esid = entriedStudents.findIndex((name) => name == student.name);
            if (esid >= 0) {
                student.id = esid;
                students[esid] = student;
            } else { // 初回レコードはそのまま追加
                students.push(student);
                entriedStudents.push(student.name);
            }
        }

        if (numSlots < students.length) {
            alert("志望者数が研究室定員総数を上回っています");
            throw new Error("志望者数超過");
        }

        // 全員が仮配属か未決定になるまでループ
        while (!checkTerminal(students)) {
            // 現時点で希望するスタジオにエントリー
            students.forEach(student => {
                if (student.entry.length > 0) {
                    const name = student.entry[0].lab;
                    let lab = labs.find(l => l.name == name);
                    lab.applicants.push({
                        id: student.id,
                        name: student.name,
                        point: student.entry[0].point,
                        gpa: student.gpa,
                        units: student.units
                    });
                }
            });
            labs.forEach(lab => {
                // ポイント&GPA&取得単位数順に降順ソート
                lab.applicants.sort(function (x, y) {
                    if (y.point != x.point) {
                        return y.point - x.point;
                    }
                    if (y.gpa != x.gpa) {
                        return y.gpa - x.gpa;
                    }
                    if (y.units == x.units) {
                        alert("同率のため比較不可: " + lab.name + " / " +
                            students[x.id].name + " - " +
                            students[y.id].name);
                        throw new Error("同率のため比較不可");
                    }
                    return y.units - x.units;
                });
                // 仮配属処理
                const numApplicants = lab.applicants.length;
                let a = 0;
                for (; a < lab.slots && a < numApplicants; ++a) {
                    const sid = lab.applicants[a].id;
                    students[sid].status = lab.name;
                }
                // 落選者処理
                for (; a < numApplicants; ++a) {
                    // 志望を繰り下げ
                    const sid = lab.applicants[a].id;
                    students[sid].status = "";
                    students[sid].entry.shift();
                    // 志望先がなくなったら未決定状態に
                    if (students[sid].entry.length <= 0) {
                        students[sid].status = "unassigned";
                    }

                    // 落選処理が行われた研究室は検索チェックをONに変更
                    // const target_namme = lab.name;
                    // let target = labs.find((l) => l.name === lab.name);
                    // target.element_search.checked(true);

                }
                lab.member = lab.applicants; // 配属されたメンバーを member として保存しておく
                // 配属者のgpaを昇順でソートする
                lab.member.sort(function (x, y) {
                    return x.gpa - y.gpa;
                });
                lab.applicants = [] // 志望者リストのクリア
            });
        }
        let sumRankn = 0;
        let statistics = Array(number_of_studio);
        statistics.fill(0);
        let displayElement = '';
        g_students = students;
        students.forEach(s => {

            // tooltip（マウスホバーで見えるヒント情報）の設定
            let entry = '' + s.name + "の配属希望一覧\n";
            if (privacy_mode) {
                entry = entry + 'GPA:' + "--" + '\n' + '取得単位:' + "--" + '\n';
            } else {
                entry = entry + 'GPA:' + s.gpa + '\n' + '取得単位:' + s.units + '\n';
            }

            for (let i = 0; i < s.entry_original.length; i++) {
                entry =
                    entry + str(i + 1) + ":" +
                    s.entry_original[i].lab + "[" +
                    s.entry_original[i].point + "]" +
                    '\n';
            }

            const rankn = (number_of_studio + 1) - s.entry.length;
            statistics[rankn - 1] += 1;
            sumRankn += rankn;

            if (rankn == 1) {
                displayElement += '<tr data-html=\"true\" data-toggle=\"tooltip\" data-placement=\"top\" title=\"' + entry + '\">';
                displayElement += '<td>' + s.name + '</td>';
                displayElement += `<td>${s.status}</td>`;
                displayElement += `<td>${rankn}</td>`;
                displayElement += '</tr>';
            } else {
                displayElement += '<tr class=\"table-danger\" data-html=\"true\" data-toggle=\"tooltip\" data-placement=\"top\" title=\"' + entry + '\">';
                displayElement += '<td>' + s.name + '</td>';
                displayElement += `<td>${s.status}</td>`;
                displayElement += `<td>${rankn}</td>`;
                displayElement += '</tr>';
            }

            // 配属された研究室の配属者数を増やす
            var lab_assigned = labs.filter(function (item, index) {
                if (item.name.indexOf(s.status) >= 0) {
                    return true;
                }
            });
            // let num = lab_assigned[0].element_assigned.value();
            // num++;
            // lab_assigned[0].element_assigned.value(num);
            lab_assigned[0].number_assigned++;
            lab_assigned[0].element_assigned.value(lab_assigned[0].number_assigned);

        });
        resultElement.innerHTML = displayElement;



        displayElement = '';
        for (let i = 0; i < labs.length; ++i) {
            displayElement += '<tr>';
            displayElement += `<td>${i + 1}</td>`;
            displayElement += `<td>${statistics[i]}</td>`;
            displayElement += `<td>${statistics[i] * 100.0 / students.length}</td>`;
            displayElement += '</tr>';
        }
        statisticsElement.innerHTML = displayElement;



        // 各研究室に配属された学生(lab.member)を tooltipでまとめて見えるようにする．
        labs.forEach(lab => {
            let list = "";
            lab.member.slice().reverse().forEach(m => {

                if (privacy_mode) {
                    list += "anonymous" + " : " + "--" + " : " + "--" + "<br>";
                } else {
                    list += m.name + " : " + m.gpa + " : " + m.units + "<br>";
                }
            });
            lab.element_td_assigned.attribute("data-html", "true");
            lab.element_td_assigned.attribute("data-toggle", "tooltip");
            lab.element_td_assigned.attribute("data-placement", "top");
            lab.element_td_assigned.attribute("title", list);
        });
        $('[data-toggle="tooltip"]').data('bs.tooltip', false).tooltip()

        console.log("done")

    } catch (e) {
        console.log(e);
    }
}


var level = {
    pos: 0,
    has_checked: false,
    shortage: 0
};

/**
 * 配属処理のメイン関数
 * 実際の配属アルゴリズムは assign() を参照すること
 * @param {bool} is_until_ended - trueの場合、配属処理の終わりまで何度も自動で繰り返す。Falseの場合、一回だけ実行する。
 * @returns 
 */
async function iamatch(is_until_ended = false) {


    if (!fileInfo) {
        window.alert("最初にファイルをアップロードしてください。");
        return;
    }

    // 実行ボタンをdisableにする（処理が全部終わるまでは次のステップに行かせない
    document.getElementById('button_execute').disabled = true;
    document.getElementById('button_batch_execute').disabled = true;

    // iamatchアニメーション設定
    if (document.getElementById('animation').checked) {
        end_time = millis() + 2000; // アニメーション時間を2秒に設定
        canvas.show(); // canvasを表示
        sound_cals.play(); // 音を鳴らす
        document.getElementById("iamatch").hidden = true;
        document.getElementById("list").hidden = true;
        is_animating = true;
        loop();
    }

    // Core 処理（この質問は向井先生へ）
    console.time("assign");
    await assign();
    console.timeEnd("assign");

    // 研究室定員削減の処理
    // assign_patterns[document.getElementById('select_combination')]に現在選択しているアサインパターン配列が格納されている。
    let selected_assign_pattern = assign_patterns[document.getElementById('select_combination').value];

    // 現在割り振りしているスタジオの人数枠
    let capacity_now = document.getElementById('max').value - level.pos;

    // capacity_now人数分、配属すべき数
    let number_to_be_assigned = selected_assign_pattern[level.pos];

    // すでに終了済み
    if (level.pos >= selected_assign_pattern.length) {
        // alert("すでに配属作業は終了しています");
        const myModal = new bootstrap.Modal(document.getElementById('myModal'));
        const dom_modal = document.getElementById('myModal');
        dom_modal.querySelector('.modal-title').innerHTML = "お知らせ";
        dom_modal.querySelector('.modal-body').innerHTML = "配属処理が完了しました。<br>異なる配属組合せを検討する場合は、「配属組合せ」を変更後、再度実行してください。";

        myModal.show();
        document.getElementById('button_execute').innerHTML = "はじめる";
        document.getElementById('button_batch_execute').innerHTML = "一括";
        document.querySelector('#button_execute').disabled = false;
        document.querySelector('#button_batch_execute').disabled = false;
        level.pos = 0;
        level.has_checked = 0;
        return;
    }
    // 現在人数枠で配属された研究室が幾つあるのかを調べる
    let assigned = labs.filter(function (lab) {
        //console.log("a", lab.element_assigned.value());
        return lab.element_assigned.value() == capacity_now;
    });
    //console.log("hello", number_to_be_assigned, assigned.length);

    // (capacity_now）分配属された研究室数が、組み合わせ研究室数より大きい場合
    if (assigned.length > number_to_be_assigned + level.shortage) {
        labs.forEach(lab => {
            lab.element_search.checked(false);
        });
        assigned.forEach(a => {
            a.element_search.checked(true);
        });

        // 定員をへらすべきスタジオ名を教えてもらう
        let reduction_studio_name = proposeReduction();

        // 該当スタジオオブジェクトを呼び出し
        let reduction_studio = labs.find(lab => {
            return reduction_studio_name === lab.name;
        });

        // 該当スタジオオブジェクトの定員を位置名減らす
        let num = reduction_studio.element_slots.value();
        num--;
        reduction_studio.element_slots.value(num);
        reduction_studio.element_search.checked(false);

        assigned = labs.filter(function (lab) {
            return lab.element_assigned.value() == capacity_now;
        });

        // すでに (max - level)よりも少ない学生しかいない研究室は一律定員を-1する
        // ただし、(max-level）での処理分につき、最初の一回だけ実行しないといけない
        if (level.has_checked == false && level.shortage == 0) {
            level.has_checked = true;
            let untargeted = labs.filter(function (lab) {
                return lab.element_assigned.value() < capacity_now;
            });
            untargeted.forEach(lab => {
                let v = lab.element_slots.value();
                v--;
                lab.element_slots.value(v);
            });
        }
    }
    // 減らすべき研究室がない場合
    else {
        level.pos++;
        level.has_checked = false;
        level.shortage = Math.max(0, number_to_be_assigned - assigned.length);
        labs.forEach(lab => {
            lab.element_search.checked(false);
        });
        for (let i = 0; i < labs.length; i++) {
            if (labs[i].element_tr.hasClass("table-danger")) {
                labs[i].element_tr.removeClass("table-danger");
            }
        }

    }

    // 実行ボタンの表記を更新
    document.getElementById('button_execute').innerHTML = "次へ(" + str(capacity_now) + "人研究室チェック中）";



    //setTimeout(proposeReduction, 400);

    // 実行ボタンをアクティブに戻す
    document.getElementById('sum_of_capacity').value = updateSlots();
    document.getElementById('button_execute').disabled = false;
    document.getElementById('button_batch_execute').disabled = false;



    // Core 処理ここまで
    if (document.getElementById('animation').checked) {
        canvas.show();
    }


    if (is_until_ended) {
        iamatch(true);
    }
}


// ファイル読み込みがあったとき（ファイルに変更があったとき）
form.student.addEventListener('change', function (event) {
    fileInfo = event.target.files[0];
    let sum_of_row = 0;
    readXlsxFile(fileInfo).then(function (rows) {
        document.getElementById("sum_student").value = rows.length - 1;
        getAssignPatterns();

        document.getElementById('button_execute').disabled = false;
        document.getElementById('button_batch_execute').disabled = false;
    });


});