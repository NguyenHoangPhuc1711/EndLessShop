

(function (root) {
  "use strict";

  const products = [
  {
    id: 1,
    name: "Áo thun basic cotton",
    category: "ao",
    price: 189000,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Xanh", "Đen", "Xanh navy", "Be", "Trắng"],
    images: [
      "img/id1.jpg",
      "img/id1.1.jpg",
      "img/id1.2.jpg",
      "img/id1.3.jpg",
      "img/id1.4.jpg"
    ],
    colorImageIndices: { "Xanh": 0, "Đen": 1, "Xanh navy": 2, "Be": 3, "Trắng": 4 },
    description: "Áo thun cotton 100%, form rộng vừa, mặc thoải mái, dễ phối đồ hằng ngày.",
    isNew: true
  },
  {
    id: 2,
    name: "Áo sơ mi tay dài",
    category: "ao",
    price: 329000,
    sizes: ["S", "M", "L"],
    colors: ["Xanh", "Đen", "Trắng"],
    images: ["img/id-2.jpg", "img/id-2.1.jpg", "img/id-2.2.jpg"],
    colorImageIndices: { "Xanh": 0, "Đen": 1, "Trắng": 2 },
    description: "Áo sơ mi vải linen mềm mại, form suông, phù hợp đi học đi làm.",
    isNew: false
  },
  {
    id: 3,
    name: "Áo khoác dù 2 lớp",
    category: "ao",
    price: 459000,
    sizes: ["M", "L", "XL"],
    colors: ["Xanh navy", "Đen", "Trắng"],
    images: ["img/id-3.jpg", "img/id-3.1.jpg", "img/id-3.2.jpg"],
    colorImageIndices: { "Xanh navy": 0, "Đen": 1, "Trắng": 2 },
    description: "Áo khoác dù chống nước nhẹ, có mũ, giữ ấm tốt cho ngày se lạnh.",
    isNew: true
  },
  {
    id: 4,
    name: "Quần jean ống suông",
    category: "quan",
    price: 379000,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Xanh", "Đen", "Trắng"],
    images: ["img/id-4.jpg", "img/id-4.1.jpg", "img/id-4.2.jpg"],
    colorImageIndices: { "Xanh": 0, "Đen": 1, "Trắng": 2 },
    description: "Quần jean form suông, chất vải dày dặn, lên form đẹp.",
    isNew: false
  },
  {
    id: 5,
    name: "Quần tây công sở",
    category: "quan",
    price: 349000,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Xám", "Đen", "Trắng"],
    images: ["img/id-5.jpg", "img/id-5.1.jpg", "img/id-5.2.jpg"],
    colorImageIndices: { "Xám": 0, "Đen": 1, "Trắng": 2 },
    description: "Quần tây ống đứng, vải co giãn nhẹ, phù hợp môi trường công sở.",
    isNew: false
  },
  {
    id: 6,
    name: "Quần short kaki",
    category: "quan",
    price: 219000,
    sizes: ["S", "M", "L", "XL"],
    colors: ["Be", "Đen", "Trắng"],
    images: ["img/id-6.jpg", "img/id-6.1.jpg", "img/id-6.2.jpg"],
    colorImageIndices: { "Be": 0, "Đen": 1, "Trắng": 2 },
    description: "Quần short kaki basic, form gọn, mặc mát mẻ ngày hè.",
    isNew: true
  },
  {
    id: 7,
    name: "Váy liền hoa nhí",
    category: "vay",
    price: 299000,
    sizes: ["S", "M", "L"],
    colors: ["Vàng", "Đen", "Trắng"],
    images: ["img/id-7.jpg", "img/id-7.1.jpg", "img/id-7.2.jpg"],
    colorImageIndices: { "Vàng": 0, "Đen": 1, "Trắng": 2 },
    description: "Váy liền thân họa tiết hoa nhí, chất vải mềm rũ, nhẹ nhàng nữ tính.",
    isNew: true
  },
  {
    id: 8,
    name: "Chân váy xếp ly",
    category: "vay",
    price: 259000,
    sizes: ["S", "M", "L"],
    colors: ["Be", "Đen", "Trắng"],
    images: ["img/id-8.jpg", "img/id-8.1.jpg", "img/id-8.2.jpg"],
    colorImageIndices: { "Be": 0, "Đen": 1, "Trắng": 2 },
    description: "Chân váy xếp ly dáng chữ A, dễ phối cùng áo thun hoặc sơ mi.",
    isNew: false
  },
  {
    id: 9,
    name: "Váy sơ mi dáng dài",
    category: "vay",
    price: 339000,
    sizes: ["M", "L", "XL"],
    colors: ["Xanh", "Đen", "Trắng"],
    images: ["img/id-9.jpg", "img/id-9.1.jpg", "img/id-9.2.jpg"],
    colorImageIndices: { "Xanh": 0, "Đen": 1, "Trắng": 2 },
    description: "Váy sơ mi dáng dài, có thắt eo, phong cách thanh lịch.",
    isNew: false
  },
  {
    id: 10,
    name: "Mũ lưỡi trai basic",
    category: "phukien",
    price: 99000,
    sizes: ["Freesize"],
    colors: ["Xanh navy", "Đen", "Trắng"],
    images: ["img/id-10.jpg", "img/id-10.1.jpg", "img/id-10.2.jpg"],
    colorImageIndices: { "Xanh navy": 0, "Đen": 1, "Trắng": 2 },
    description: "Mũ lưỡi trai form chuẩn, có khóa điều chỉnh phía sau.",
    isNew: false
  },
  {
    id: 11,
    name: "Túi tote vải bố",
    category: "phukien",
    price: 149000,
    sizes: ["Freesize"],
    colors: ["Be", "Đen", "Trắng"],
    images: ["img/id-11.jpg", "img/id-11.1.jpg", "img/id-11.2.jpg"],
    colorImageIndices: { "Be": 0, "Đen": 1, "Trắng": 2 },
    description: "Túi tote vải bố dày dặn, sức chứa lớn, tiện dụng khi đi học đi làm.",
    isNew: true
  },
  {
    id: 12,
    name: "Thắt lưng da basic",
    category: "phukien",
    price: 179000,
    sizes: ["105 cm", "110 cm", "115 cm", "120 cm"],
    colors: ["Nâu", "Đen"],
    images: ["img/id-12.jpg", "img/id-12.1.jpg"],
    colorImageIndices: { "Nâu": 0, "Đen": 1 },
    description: "Thắt lưng da tổng hợp, khóa kim loại chắc chắn, dễ phối nhiều loại quần.",
    isNew: false
  }
  ];


  const outfitSuggestions = {
  1: [4, 6, 10],
  2: [5, 12, 11],
  3: [4, 1, 10],
  4: [1, 3, 12],
  5: [2, 12, 9],
  6: [1, 10, 11],
  7: [11, 10],
  8: [1, 2, 12],
  9: [12, 11],
  10: [1, 6],
  11: [2, 8],
  12: [5, 2]
  };


  const sizeChart = [
  { size: "S", chest: "84-88", waist: "64-68", height: "155-162" },
  { size: "M", chest: "89-93", waist: "69-73", height: "160-168" },
  { size: "L", chest: "94-98", waist: "74-78", height: "165-172" },
  { size: "XL", chest: "99-104", waist: "79-84", height: "170-178" }
  ];

  Object.assign(root.Endless, {
    products: products,
    outfitSuggestions: outfitSuggestions,
    sizeChart: sizeChart
  });
})(window);
