"use client";

import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DollarSign, ArrowDown, ArrowUp, X, Loader2, CheckCircle, PlusCircle, MinusCircle } from "lucide-react";

export default function TransactionDialog({ isOpen, onClose, user }) {
  const dispatch = useDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: "deposit",
    amount: "",
    description: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        type: "deposit",
        amount: "",
        description: "",
      });
      setErrors({});
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleTypeChange = (value) => {
    setFormData((prev) => ({ ...prev, type: value }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.amount || isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Please enter a valid amount greater than 0";
    }
    
    if (!formData.description.trim()) {
      newErrors.description = "Please enter a description";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Here you would dispatch an action to handle the transaction
      // For example: await dispatch(processTransaction({ userId: user._id, ...formData })).unwrap();
      
      // For now, we'll just simulate a successful transaction
      setTimeout(() => {
        onClose();
        // You might want to show a success message or refresh user data
      }, 1000);
    } catch (error) {
      console.error("Transaction failed:", error);
      setErrors((prev) => ({ ...prev, submit: "Transaction failed. Please try again." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {formData.type === "deposit" ? "Deposit Funds" : "Withdraw Funds"}
          </DialogTitle>
          <DialogDescription>
            {user && (
              <span className="text-sm">
                User: <span className="font-medium">{user.firstName} {user.lastName}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4 transaction-form">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Transaction Type <span className="text-red-500">*</span>
            </Label>
            <RadioGroup
              value={formData.type}
              onValueChange={handleTypeChange}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="deposit" id="deposit" />
                <Label htmlFor="deposit" className="flex items-center cursor-pointer">
                  <ArrowDown className="h-4 w-4 text-emerald-500 mr-2" />
                  Deposit
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="withdraw" id="withdraw" />
                <Label htmlFor="withdraw" className="flex items-center cursor-pointer">
                  <ArrowUp className="h-4 w-4 text-rose-500 mr-2" />
                  Withdraw
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
              Amount <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                placeholder="0.00"
                className={`pl-10 border border-gray-200 rounded-none w-full ${errors.amount ? 'border-red-500' : ''}`}
                value={formData.amount}
                onChange={handleChange}
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount}</p>
            )}
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">
              Description <span className="text-red-500">*</span>
            </Label>
            <div className="border border-gray-200 rounded-none">
              <Textarea
                id="description"
                name="description"
                placeholder="Enter transaction details..."
                className={`border-0 focus:outline-none focus:ring-0 rounded-none w-full ${errors.description ? 'border-red-500' : ''}`}
                value={formData.description}
                onChange={handleChange}
                rows={3}
              />
            </div>
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description}</p>
            )}
          </div>
          
          {/* Submit Error */}
          {errors.submit && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 rounded-none px-4"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
              className={`h-10 ${formData.type === "deposit" 
                ? "bg-emerald-600 hover:bg-emerald-700" 
                : "bg-rose-600 hover:bg-rose-700"} text-white rounded-none px-4`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {formData.type === "deposit" 
                    ? <PlusCircle className="h-4 w-4 mr-2" />
                    : <MinusCircle className="h-4 w-4 mr-2" />
                  }
                  {formData.type === "deposit" ? "Deposit Funds" : "Withdraw Funds"}
                </>
              )}
            </Button>
          </div>
          
          {/* Add global styles for this component */}
          <style jsx global>{`
            /* Remove focus outline from all inputs in this form */
            .transaction-form input:focus, 
            .transaction-form textarea:focus {
              outline: none !important;
              box-shadow: none !important;
              border-color: #e5e7eb !important;
            }
            
            /* Remove number input arrows */
            input[type=number]::-webkit-inner-spin-button, 
            input[type=number]::-webkit-outer-spin-button { 
              -webkit-appearance: none; 
              margin: 0; 
            }
            input[type=number] {
              -moz-appearance: textfield;
            }
          `}</style>
        </form>
      </DialogContent>
    </Dialog>
  );
} 