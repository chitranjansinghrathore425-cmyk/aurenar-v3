import { supabase } from "./supabase-client.js";

const fallbackProducts=[
 {id:"demo-1",name:"White Linen Shirt",price:1499,image_url:"",category:"men",sizes:["S","M","L","XL"],description:"A clean linen essential."},
 {id:"demo-2",name:"Noir Overshirt",price:1899,image_url:"",category:"men",sizes:["S","M","L","XL"],description:"A structured everyday layer."},
 {id:"demo-3",name:"Stone Trousers",price:1799,image_url:"",category:"men",sizes:["30","32","34","36"],description:"Relaxed tailored trousers."}
];
let products=[], cart=JSON.parse(localStorage.getItem("aurenar_cart")||"[]"), wish=JSON.parse(localStorage.getItem("aurenar_wish")||"[]");

const $=id=>document.getElementById(id);
const money=n=>"₹"+Number(n||0).toLocaleString("en-IN");
function save(){localStorage.setItem("aurenar_cart",JSON.stringify(cart));localStorage.setItem("aurenar_wish",JSON.stringify(wish));}
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1600)}
function openDrawer(id){$(id).classList.add("open");$("overlay").classList.add("open")}
function closeAll(){$$(".drawer").forEach(x=>x.classList.remove("open"));$("overlay").classList.remove("open")}
const $$=s=>document.querySelectorAll(s);

async function load(){
  try{
    const {data,error}=await supabase.from("products").select("*").eq("is_active",true).order("created_at",{ascending:false});
    if(error) throw error; products=data||[];
  }catch(e){products=[]}
  if(!products.length) products=fallbackProducts;
  render(); $("status").textContent=`${products.length} pieces`;
}
function render(){
 $("products").innerHTML=products.map(p=>`<article class="product-card">
 <button class="wishlist" data-wish="${p.id}">${wish.includes(String(p.id))?"♥":"♡"}</button>
 <a href="/product.html?id=${encodeURIComponent(p.id)}"><div class="product-photo">${p.image_url?`<img src="${p.image_url}" alt="${esc(p.name)}">`:`<div class="placeholder">AURENAR</div>`}</div></a>
 <div class="product-info"><div class="product-name">${esc(p.name)}</div><div class="product-price">${money(p.price)}</div>
 <div class="card-actions"><button data-add="${p.id}">ADD TO BAG</button><button onclick="location.href='/product.html?id=${encodeURIComponent(p.id)}'">VIEW</button></div></div></article>`).join("");
 $("bagCount").textContent=cart.reduce((a,x)=>a+x.qty,0); renderBag();
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function add(id){const p=products.find(x=>String(x.id)===String(id));if(!p)return;const x=cart.find(x=>String(x.id)===String(id));x?x.qty++:cart.push({id:p.id,qty:1});save();render();openDrawer("bagDrawer");toast("Added to bag")}
function renderBag(){if(!cart.length){$("bagBody").innerHTML="<p class='muted'>Your bag is empty.</p>";$("bagFoot").innerHTML="";return}
 let total=0;$("bagBody").innerHTML=cart.map(x=>{const p=products.find(y=>String(y.id)===String(x.id));if(!p)return "";total+=p.price*x.qty;return `<div class="bag-row"><div>${esc(p.name)}<br><small>${money(p.price)} × ${x.qty}</small></div><div><button data-minus="${p.id}">−</button> ${x.qty} <button data-plus="${p.id}">+</button></div></div>`}).join("");
 $("bagFoot").innerHTML=`<p>Total: <strong>${money(total)}</strong></p><button class="primary" id="checkoutBtn">CHECKOUT</button>`;
}
function change(id,d){const x=cart.find(x=>String(x.id)===String(id));if(!x)return;x.qty+=d;if(x.qty<1)cart=cart.filter(y=>String(y.id)!==String(id));save();render()}
function renderSearch(q=""){const a=products.filter(p=>String(p.name).toLowerCase().includes(q.toLowerCase()));$("searchResults").innerHTML=a.map(p=>`<div class="search-item"><a href="/product.html?id=${encodeURIComponent(p.id)}"><strong>${esc(p.name)}</strong><br><small>${money(p.price)}</small></a></div>`).join("")||"<p class='muted'>No pieces found.</p>"}
async function account(){openDrawer("accountDrawer");$("accountBody").innerHTML="<p class='muted'>Checking account…</p>";const {data}=await supabase.auth.getUser();$("accountBody").innerHTML=data.user?`<p>Signed in as <strong>${esc(data.user.email)}</strong></p><button class="primary" id="signout">SIGN OUT</button>`:`<p>Customer account is available in V3.</p><p class='muted'>Sign-in UI is ready for Supabase Auth connection.</p>`}
document.addEventListener("click",e=>{const a=e.target.closest("[data-add]");if(a)add(a.dataset.add);const w=e.target.closest("[data-wish]");if(w){const id=String(w.dataset.wish);wish=wish.includes(id)?wish.filter(x=>x!==id):[...wish,id];save();render()}
const mi=e.target.closest("[data-minus]");if(mi)change(mi.dataset.minus,-1);const pl=e.target.closest("[data-plus]");if(pl)change(pl.dataset.plus,1);if(e.target.id==="bagBtn")openDrawer("bagDrawer");if(e.target.id==="accountBtn")account();if(e.target.id==="searchBtn"){openDrawer("searchDrawer");$("searchInput").focus();renderSearch()}if(e.target.dataset.close)closeAll();if(e.target.id==="signout")supabase.auth.signOut().then(account);if(e.target.id==="checkoutBtn")toast("Checkout UI ready — payment gateway not connected yet");});
$("overlay").addEventListener("click",closeAll);$("searchInput").addEventListener("input",e=>renderSearch(e.target.value));$("menuBtn").addEventListener("click",()=>$("mobileNav").classList.toggle("open"));
load();
