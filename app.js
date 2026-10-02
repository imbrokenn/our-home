const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();

const fallbackId = new URLSearchParams(location.search).get("telegram_id");
const initUser = tg?.initDataUnsafe?.user;
const telegramId = initUser?.id || fallbackId;
const userName = initUser?.first_name || "Пользователь";

const categories = ["Продукты","Молочка","Мясо и рыба","Овощи и фрукты","Хлеб и выпечка","Бакалея","Напитки","Сладости","Заморозка","Бумажные товары","Гигиена","Бытовая химия","Уборка","Животные","Другое"];
const $ = id => document.getElementById(id);
let state = {products:[],shopping:[]};

categories.forEach(c => $("category").insertAdjacentHTML("beforeend", `<option>${c}</option>`));

async function load(){
  if(!telegramId){ $("products").innerHTML="<div class='card'>Открой приложение через Telegram.</div>"; return; }
  const r=await fetch(`/api/state?telegram_id=${telegramId}`);
  state=await r.json(); render();
}
function render(){
  const low=state.products.filter(p=>Number(p.min_quantity)>0 && Number(p.quantity)<=Number(p.min_quantity)).length;
  $("summary").innerHTML=`<div class="pill"><b>${state.products.length}</b> позиций</div><div class="pill"><b>${low}</b> заканчивается</div><div class="pill"><b>${state.shopping.filter(x=>!x.is_bought).length}</b> купить</div>`;
  $("products").innerHTML=state.products.map(p=>{
    const low=Number(p.min_quantity)>0&&Number(p.quantity)<=Number(p.min_quantity);
    const exp=p.expiration_date?`до ${new Date(p.expiration_date+"T00:00:00").toLocaleDateString("ru-RU")}`:"";
    return `<div class="card"><div class="cardtop"><div><div class="name">${esc(p.name)}</div><div class="muted">${esc(p.category)} · ${p.quantity} ${esc(p.unit||"шт.")} ${exp?"· "+exp:""}</div></div>${low?'<span class="badge danger">Заканчивается</span>':""}</div><div class="actions"><button onclick="changeQty(${p.id},-1)">−</button><button onclick="changeQty(${p.id},1)">＋</button><button onclick="removeProduct(${p.id})">Удалить</button></div></div>`;
  }).join("") || `<div class="card">Пока ничего нет. Добавь первую вещь 🏠</div>`;
  $("shoppingList").innerHTML=state.shopping.map(x=>`<div class="shoprow"><input type="checkbox" ${x.is_bought?"checked":""} onchange="buy(${x.id},this.checked)"><div style="flex:1">${esc(x.name)} <span class="muted">— ${x.quantity} ${esc(x.unit||"шт.")}</span></div><button onclick="deleteShop(${x.id})">✕</button></div>`).join("")||`<div class="card">Список покупок пуст 🛒</div>`;
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
async function changeQty(id,d){const p=state.products.find(x=>x.id===id);await fetch(`/api/product/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({quantity:Math.max(0,Number(p.quantity)+d)})});load()}
async function removeProduct(id){await fetch(`/api/product/${id}`,{method:"DELETE"});load()}
async function buy(id,v){await fetch(`/api/shopping/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_bought:v})});load()}
async function deleteShop(id){await fetch(`/api/shopping/${id}`,{method:"DELETE"});load()}

$("addBtn").onclick=()=>openModal("product");
$("shopAddBtn").onclick=async()=>{const n=prompt("Что купить?");if(n)await fetch("/api/shopping",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({telegram_id:telegramId,user_name:userName,name:n})});load()};
$("close").onclick=()=>$("modal").classList.add("hidden");
$("save").onclick=async()=>{const payload={telegram_id:telegramId,user_name:userName,name:$("name").value,category:$("category").value,quantity:$("quantity").value,unit:$("unit").value||"шт.",min_quantity:$("min").value||0,expiration_date:$("expiry").value||null};if(!payload.name.trim())return;await fetch("/api/product",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});$("modal").classList.add("hidden");$("name").value="";load()};
$("inviteBtn").onclick=async()=>{const r=await fetch("/api/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({telegram_id:telegramId})});const d=await r.json();tg?.showAlert?.("Код для второго человека: "+d.code);if(!tg?.showAlert)alert("Код: "+d.code)};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("home").classList.toggle("hidden",b.dataset.tab!=="home");$("shopping").classList.toggle("hidden",b.dataset.tab!=="shopping")});
function openModal(){ $("modal").classList.remove("hidden"); $("name").focus(); }
load();
