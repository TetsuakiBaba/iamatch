// 配属組み合わせを計算するためのコード Tetsuaki Baba
// 下限（min），上限(max), 研究室数（sum_studio），配属人数（sum_student)から自動的に候補を算出する
// 必要なDOMを用意した後，getAssignPattern()を呼び出すだけ．中身は再帰関数になっている．

var studio_patterns = [];
var assign_patterns = [];　 // この配列に候補となる組み合わせが格納される

function getCandidateStudioCombination(A) {
    var min = int(document.getElementById("min").value);
    var max = int(document.getElementById("max").value);
    var sum_studio = int(document.getElementById("sum_studio").value);

    // 終端条件 
    if (A.length == (max - min + 1)) {

        let sum = 0;
        A.forEach(a => {
            sum += a;
        });
        if (sum == sum_studio) {
            studio_patterns.push(A.concat());
        }
        return;
    }

    for (let i = 0; i <= sum_studio; i++) {
        A.push(i)
        getCandidateStudioCombination(A)
        A.pop() //# これが結構ポイント
    }
}



function getAssignPatterns() {

    // 組み合わせによっては時間がかかる場合があるので，組み合わせを計算中アニメーションを表示させておく．
    var place_to_show = document.getElementById("assign_patterns_placeholder");
    studio_patterns = [];
    assign_patterns = [];
    var min = document.getElementById("min").value;
    var max = document.getElementById("max").value;
    var sum_studio = document.getElementById("sum_studio").value;
    var sum_student = document.getElementById("sum_student").value;


    // 合計が13になるスタジオ構成のすべての組み合わせを返す
    getCandidateStudioCombination([]);

    // 検索数が多すぎる場合にbreakしたかったので、someメソッドを使ってます。分かりづらい。
    studio_patterns.some(function (r) {
        let sum = 0;
        var num = [];
        for (let i = max; i >= min; i--) {
            num.push(int(i));
        }
        sum = 0;
        for (let i = 0; i < r.length; i++) {
            sum += r[i] * num[i];
        }

        if (sum == sum_student) {
            assign_patterns.push(r);
        }
        console.log(assign_patterns.length);
        if (assign_patterns.length > 50) {
            alert("配属パターンが多すぎるため処理を中断しました。最大50パターンまです。上限および下限を操作して配属パターンを減らしてください。");
            return true;
        }
    });
    //console.log(assign_patterns);

    var place_to_show = document.getElementById("assign_patterns_placeholder");
    place_to_show.innerHTML = "読み込んだエクセルファイルから配属可能パターンを自動計算しました。配属組合せを選択して配属処理を開始できます。<br>（例：[5,2,1,0] -> 5人スタジオが5つ，4人スタジオが2つ、3人スタジオが1つ、2人スタジオが0）<br><br><h4>今回選択可能な配属組合せ</h4>[ ";
    for (let i = max; i >= min; i--) {
        place_to_show.innerHTML += str(i) + "人配属研究室,";
    }
    place_to_show.innerHTML += "]<br>";
    assign_patterns.forEach(pattern => {
        place_to_show.innerHTML += "[ " + pattern + " ]<br>";
    });



    // select要素に組み合わせをappendChildする。
    let select = document.getElementById("select_combination");
    var options = select.options;
    for (let i = options.length - 1; i >= 0; i--) {
        select.removeChild(options[i]);

    }
    //elm.remove();
    for (let i = 0; i < assign_patterns.length; i++) {
        var option = document.createElement("option");
        // optionタグのテキストを配列表示に設定する
        option.text = str(assign_patterns[i]);
        // optionタグのvalueには対応する assignd_patterns の配列番号を保存する
        option.value = i;
        // selectタグの子要素にoptionタグを追加する
        select.appendChild(option);
    }

    // alert(place_to_show.innerHTML);
    const myModal = new bootstrap.Modal(document.getElementById('myModal'));
    const dom_modal = document.getElementById('myModal');
    dom_modal.querySelector('.modal-body').innerHTML = place_to_show.innerHTML;
    dom_modal.querySelector('.modal-title').innerHTML = "配属可能なパターン一覧";
    myModal.show();

    //console.log(assign_patterns[select.value]);

}