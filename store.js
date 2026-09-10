import { supabase } from './supabase-client.js';

const FALLBACK = [
  { id:'fallback-1', name:'White Linen Shirt', slug:'white-linen-shirt', price:1499, compare_at_price:null, description:'A clean linen essential with a relaxed, considered silhouette.', images:['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1200&q=82'], sizes:['S','M','L','XL'], stock:25, is_active:true },
  { id:'fallback-2', name:'Noir Overshirt', slug:'noir-overshirt', price:1899, compare_at_price:null, description:'A structured everyday layer in a deep, understated tone.', images:['https://images.unsplash.com/photo-1598808503746-f34c53b9323e?auto=format&fit=crop&w=1200&q=82'], sizes:['S','M','L','XL'], stock:18, is_active:true },
  { id:'fallback-3', name:'Stone Trousers', slug:'stone-trousers', price:1799, compare_at_price:null, description:'Relaxed tailored trousers designed for an effortless line.', images:['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1200&q=82'], sizes:['30','32','34','36'], stock:14, is_active:true }
];

let products=[];
let cart=readJSON('aurenar_cart',[]);
let wishlist=readJSON('aurenar_wishlist',[]);
let activeFilter='all';

const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function readJSON(k,f){try{return JSON.parse(localStorage.getItem(k)) ?? f}catch{return f}}
function save(){localStorage.setItem('aurenar_cart',JSON.stringify(cart));localStorage.setItem('aurenar_wishlist',JSON.stringify(wishlist))}
function money(n){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n)||0)}
function imgs(p){if(Array.isArray(p.images))return p.images.filter(Boolean); if(typeof p.images==='string'){try{const x=JSON.parse(p.images);return Array.isArray(x)?x:[p.images]}catch{return [p.images]}} return []}
function normalize(p){return {...p,images:imgs(p),sizes:Array.isArray(p.sizes)?p.sizes:[],stock:Number(p.stock)||0}}
function safe(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function productImage(p){return imgs(p)[0] || 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=82'}

async function loadProducts(){
  const status=$('#productStatus');
  try{
    const {data,error}=await supabase.from('products').select('id,name,slug,description,price,compare_at_price,images,sizes,stock,is_active,created_at,updated_at').eq('is_active',true).order('created_at',{ascending:false});
    if(error) throw error;
    products=(data||[]).map(normalize);
    if(!products.length) products=FALLBACK;
    if(status) status.textContent=products.length ? `${products.length} pieces` : '';
  }catch(err){
    console.warn('AURENAR: product load failed; using fallback collection.',err);
    products=FALLBACK;
    if(status) status.textContent='Showing the preview collection';
  }
  renderProducts(); renderBag(); updateBagCount();
}
function filtered(){return activeFilter==='all'?products:products.filter(p=>String(p.name).toLowerCase().includes(activeFilter)||String(p.description||'').toLowerCase().includes(activeFilter))}
function renderProducts(){
  const root=$('#products'); if(!root)return;
  const list=filtered();
  root.innerHTML=list.map((p,i)=>`<article class="product-card"><a class="product-image" href="/product.html?slug=${encodeURIComponent(p.slug)}"><img src="${safe(productImage(p))}" alt="${safe(p.name)}" loading="${i<4?'eager':'lazy'}"><span class="product-index">${String(i+1).padStart(2,'0')}</span></a><button class="wishlist-btn ${wishlist.includes(p.id)?'is-liked':''}" data-wish="${safe(p.id)}" aria-label="${wishlist.includes(p.id)?'Remove from wishlist':'Add to wishlist'}">♡</button><div class="product-info"><a href="/product.html?slug=${encodeURIComponent(p.slug)}"><h3>${safe(p.name)}</h3><p>${money(p.price)} ${p.compare_at_price?`<del>${money(p.compare_at_price)}</del>`:''}</p></a><button class="mini-add" data-add="${safe(p.id)}" ${p.stock<=0?'disabled':''}>${p.stock<=0?'OUT OF STOCK':'ADD TO BAG'}</button></div></article>`).join('');
  $$('.wishlist-btn',root).forEach(b=>b.addEventListener('click',()=>toggleWish(b.dataset.wish)));
  $$('.mini-add',root).forEach(b=>b.addEventListener('click',()=>addToBag(b.dataset.add)));
}
function toggleWish(id){wishlist=wishlist.includes(id)?wishlist.filter(x=>String(x)!==String(id)):[...wishlist,id];save();renderProducts();toast(wishlist.includes(id)?'Added to wishlist':'Removed from wishlist')}
function findProduct(id){return products.find(p=>String(p.id)===String(id))}
function addToBag(id,size){const p=findProduct(id);if(!p)return;if(p.stock<=0){toast('This piece is currently out of stock');return}const chosen=size || (p.sizes?.length===1?p.sizes[0]:null);if(p.sizes?.length&&!chosen){openProductChooser(p);return}const key=`${p.id}::${chosen||''}`;const item=cart.find(x=>x.key===key);if(item)item.qty=Math.min(item.qty+1,p.stock);else cart.push({key,id:p.id,size:chosen||'',qty:1});save();renderBag();updateBagCount();toast('Added to bag');openDrawer('bagDrawer')}
function changeQty(key,d){const x=cart.find(i=>i.key===key),p=x&&findProduct(x.id);if(!x||!p)return;x.qty=Math.max(0,Math.min(p.stock,x.qty+d));if(!x.qty)cart=cart.filter(i=>i.key!==key);save();renderBag();updateBagCount()}
function removeBag(key){cart=cart.filter(i=>i.key!==key);save();renderBag();updateBagCount()}
function bagSubtotal(){return cart.reduce((t,x)=>t+(findProduct(x.id)?.price||0)*x.qty,0)}
function updateBagCount(){const n=cart.reduce((t,x)=>t+x.qty,0); $$('#bagCount').forEach(el=>el.textContent=n)}
function renderBag(){const body=$('#bagBody'),foot=$('#bagFoot');if(!body)return;if(!cart.length){body.innerHTML='<div class="empty-state"><p>Your bag is empty.</p><a class="line-link" href="/#shop">CONTINUE SHOPPING ↗</a></div>';foot.innerHTML='';return}body.innerHTML=cart.map(x=>{const p=findProduct(x.id);if(!p)return '';return `<div class="bag-item"><img src="${safe(productImage(p))}" alt="${safe(p.name)}"><div class="bag-item-main"><a href="/product.html?slug=${encodeURIComponent(p.slug)}"><strong>${safe(p.name)}</strong></a><span>${x.size?`Size ${safe(x.size)} · `:''}${money(p.price)}</span><div class="qty"><button data-qty="${safe(x.key)}" data-d="-1" aria-label="Decrease quantity">−</button><span>${x.qty}</span><button data-qty="${safe(x.key)}" data-d="1" aria-label="Increase quantity">+</button><button class="remove" data-remove="${safe(x.key)}">REMOVE</button></div></div></div>`}).join('');$$('[data-qty]',body).forEach(b=>b.addEventListener('click',()=>changeQty(b.dataset.qty,Number(b.dataset.d))));$$('[data-remove]',body).forEach(b=>b.addEventListener('click',()=>removeBag(b.dataset.remove)));const subtotal=bagSubtotal(),shipping=subtotal>=2500?0:199;foot.innerHTML=`<div class="totals"><span>SUBTOTAL</span><strong>${money(subtotal)}</strong><span>SHIPPING</span><strong>${shipping?money(shipping):'COMPLIMENTARY'}</strong><span class="total-line">TOTAL</span><strong class="total-line">${money(subtotal+shipping)}</strong></div><button class="primary-btn" id="checkoutBtn">PROCEED TO CHECKOUT</button>`;$('#checkoutBtn',foot)?.addEventListener('click',()=>{openCheckout()})}
function openProductChooser(p){const options=(p.sizes||[]).map(s=>`<button class="size-option" data-size="${safe(s)}">${safe(s)}</button>`).join('');showModal(`SELECT SIZE · ${safe(p.name)}`,`<div class="size-grid">${options}</div>`);$$('.size-option').forEach(b=>b.addEventListener('click',()=>{closeModal();addToBag(p.id,b.dataset.size)}))}
function showModal(title,html){let m=$('#quickModal');if(!m){m=document.createElement('div');m.id='quickModal';m.className='quick-modal';document.body.appendChild(m)}m.innerHTML=`<div class="quick-modal-card"><button class="close-btn" data-modal-close>×</button><p class="eyebrow">AURENAR</p><h2>${title}</h2>${html}</div>`;m.classList.add('open');$('[data-modal-close]',m).addEventListener('click',closeModal)}function closeModal(){$('#quickModal')?.classList.remove('open')}
function openDrawer(id){const el=$('#'+id),ov=$('#overlay');if(!el)return;el.classList.add('open');el.setAttribute('aria-hidden','false');if(ov){ov.hidden=false;ov.classList.add('open')}}function closeDrawer(id){const el=$('#'+id);if(el){el.classList.remove('open');el.setAttribute('aria-hidden','true')}if(!$$('.drawer.open').length){const ov=$('#overlay');if(ov){ov.classList.remove('open');ov.hidden=true}}}
function openCheckout(){renderCheckout();openDrawer('checkoutDrawer')}
function renderCheckout(){const s=$('#checkoutSummary');if(!s)return;const subtotal=bagSubtotal(),shipping=subtotal>=2500?0:199;s.innerHTML=`<div><span>SUBTOTAL</span><strong>${money(subtotal)}</strong></div><div><span>SHIPPING</span><strong>${shipping?money(shipping):'COMPLIMENTARY'}</strong></div><div class="summary-total"><span>TOTAL</span><strong>${money(subtotal+shipping)}</strong></div>`}
async function renderAccount(){const body=$('#accountBody');if(!body)return;body.innerHTML='<p>Loading account…</p>';const {data:{session}}=await supabase.auth.getSession();if(!session){body.innerHTML=`<div class="account-intro"><p class="eyebrow">YOUR AURENAR ACCOUNT</p><h2>Keep your collection close.</h2><p>Sign in to save your wishlist and keep your account ready for future orders.</p></div><form id="authForm" class="auth-form"><input required name="email" type="email" placeholder="Email address"><input required name="password" type="password" minlength="6" placeholder="Password"><button class="primary-btn" type="submit">SIGN IN</button><button class="secondary-btn" type="button" id="signupBtn">CREATE ACCOUNT</button><p id="authMessage" class="form-message"></p></form>`;$('#authForm',body).addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const {error}=await supabase.auth.signInWithPassword({email:fd.get('email'),password:fd.get('password')});$('#authMessage').textContent=error?error.message:'Signed in.';if(!error){toast('Welcome back');renderAccount()}});$('#signupBtn',body).addEventListener('click',async()=>{const f=$('#authForm'),fd=new FormData(f);const {error}=await supabase.auth.signUp({email:fd.get('email'),password:fd.get('password')});$('#authMessage').textContent=error?error.message:'Account created. Check your email if confirmation is enabled.'});return}body.innerHTML=`<div class="account-intro"><p class="eyebrow">SIGNED IN</p><h2>${safe(session.user.email)}</h2><p>Your account is ready for future order history and faster checkout.</p></div><div class="account-actions"><button class="secondary-btn" id="signOutBtn">SIGN OUT</button><button class="secondary-btn" id="wishlistBtn">VIEW WISHLIST (${wishlist.length})</button></div>`;$('#signOutBtn',body).addEventListener('click',async()=>{await supabase.auth.signOut();renderAccount();toast('Signed out')});$('#wishlistBtn',body).addEventListener('click',()=>{closeDrawer('accountDrawer');activeFilter='all';document.querySelector('#shop')?.scrollIntoView({behavior:'smooth'});toast('Wishlist items are marked with ♥')})}
function openSearch(){openDrawer('searchDrawer');setTimeout(()=>$('#searchInput')?.focus(),100);renderSearch('')}
function renderSearch(q){const r=$('#searchResults');if(!r)return;const query=q.trim().toLowerCase();const list=query?products.filter(p=>`${p.name} ${p.description||''}`.toLowerCase().includes(query)):products.slice(0,5);r.innerHTML=list.map(p=>`<a class="search-result" href="/product.html?slug=${encodeURIComponent(p.slug)}"><img src="${safe(productImage(p))}" alt=""><span><strong>${safe(p.name)}</strong><small>${money(p.price)}</small></span></a>`).join('') || '<p class="empty-state">No pieces found.</p>'}
function toast(message){const t=$('#toast');if(!t)return;t.textContent=message;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2200)}
function wire(){
  $('#bagBtn')?.addEventListener('click',()=>openDrawer('bagDrawer'));$('#accountBtn')?.addEventListener('click',()=>{openDrawer('accountDrawer');renderAccount()});$('#searchBtn')?.addEventListener('click',openSearch);$('#searchInput')?.addEventListener('input',e=>renderSearch(e.target.value));
  $('#overlay')?.addEventListener('click',()=>$$('.drawer.open').forEach(d=>closeDrawer(d.id)));$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDrawer(b.dataset.close)));
  $$('.filter,[data-filter]').forEach(b=>b.addEventListener('click',e=>{const f=b.dataset.filter;if(!f)return;activeFilter=f;$$('.filter').forEach(x=>x.classList.toggle('is-active',x.dataset.filter===f));document.querySelector('#shop')?.scrollIntoView({behavior:'smooth'});renderProducts()}));
  $('#menuBtn')?.addEventListener('click',()=>{const n=$('#mobileNav');n.classList.toggle('open');n.setAttribute('aria-hidden',n.classList.contains('open')?'false':'true')});
  $('#checkoutForm')?.addEventListener('submit',e=>e.preventDefault());
  window.addEventListener('storage',()=>{cart=readJSON('aurenar_cart',[]);wishlist=readJSON('aurenar_wishlist',[]);renderProducts();renderBag();updateBagCount()});
}
wire();loadProducts();
export { products, addToBag, money, productImage, findProduct };
