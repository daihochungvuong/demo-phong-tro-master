const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Định nghĩa lại Schema tối giản khớp cấu trúc bắt buộc của file NguoiDung.ts
const NguoiDungSchema = new mongoose.Schema({
  ten: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  matKhau: { type: String, required: true },
  password: { type: String, required: true },
  soDienThoai: { type: String },
  phone: { type: String },
  vaiTro: { type: String, enum: ['admin', 'chuNha', 'nhanVien'], default: 'admin' },
  role: { type: String, enum: ['admin', 'chuNha', 'nhanVien'], default: 'admin' },
  trangThai: { type: String, default: 'hoatDong' },
  isActive: { type: Boolean, default: true },
  ngayTao: { type: Date, default: Date.now },
  ngayCapNhat: { type: Date, default: Date.now }
}, { collection: 'nguoidungs' });

async function run() {
  const uri = "mongodb://admintison:tisonpaint@mongo-primary:27017,mongo-secondary-1:27017,mongo-secondary-2:27017/QuanLyPhongTro?replicaSet=rs0&authSource=admin";
  
  try {
    await mongoose.connect(uri);
    console.log("-> Đã kết nối cơ sở dữ liệu thành công.");

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash("admin123", salt);

    // Xóa bỏ các bản ghi cũ lỗi nếu có để tránh trùng lặp Unique Email
    await mongoose.connection.db.collection('nguoidungs').deleteMany({ email: "admin@example.com" });
    await mongoose.connection.db.collection('users').deleteMany({ email: "admin@example.com" });

    const Model = mongoose.model('NguoiDung', NguoiDungSchema);
    
    const adminUser = new Model({
      ten: "Quản Trị Viên",
      name: "Quản Trị Viên",
      email: "admin@example.com",
      matKhau: hashedPassword,
      password: hashedPassword,
      soDienThoai: "0987654321",
      phone: "0987654321",
      vaiTro: "admin",
      role: "admin"
    });

    await adminUser.save();
    console.log("==> TẠO TÀI KHOẢN ADMIN THÀNH CÔNG! Mật khẩu là: admin123");
    
  } catch (err) {
    console.error("Lỗi thực thi:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
