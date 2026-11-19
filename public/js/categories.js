"use strict";

document.addEventListener("DOMContentLoaded",()=>{

    console.log("🍔 CATEGORIES JS LOADED");

    document.querySelectorAll(".category-card").forEach(card=>{

        card.onclick=()=>{
            const page=card.dataset.page;
            if(page) location.href=page;
        };

    });

});